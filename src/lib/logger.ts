import path from 'path';
import type { LlmProviderConfig, PromptLogOptions } from '@/types';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const PROMPTS_DIR = path.join(LOGS_DIR, 'prompts');

type MinimalLogger = {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
};

// Fallback no-op / console loggers if Winston is not installed or fails to initialize
const fallbackPromptLogger: MinimalLogger = {
  info: () => {},
  warn: (msg: string) => console.warn(`[PromptLogger Warn] ${msg}`),
  error: (msg: string) => console.error(`[PromptLogger Error] ${msg}`),
};

const fallbackAppLogger: MinimalLogger = {
  info: (msg: string, meta?: unknown) => console.log(`[INFO] ${msg}`, meta ?? ''),
  warn: (msg: string, meta?: unknown) => console.warn(`[WARN] ${msg}`, meta ?? ''),
  error: (msg: string, meta?: unknown) => console.error(`[ERROR] ${msg}`, meta ?? ''),
};

let promptLoggerInstance: MinimalLogger = fallbackPromptLogger;
let appLoggerInstance: MinimalLogger = fallbackAppLogger;
let isWinstonReady = false;

try {
  // Dynamically require winston & winston-daily-rotate-file for resilience
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const winston = require('winston');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DailyRotateFile = require('winston-daily-rotate-file');

  const promptTextFormat = winston.format.printf((info: Record<string, unknown>) => {
    const { timestamp, provider, model, attempt, maxRetries, systemPrompt, userPrompt, diagnostics } = info;

    const separator = '='.repeat(80);
    const subSeparator = '-'.repeat(80);

    const diag = (diagnostics as {
      systemChars?: number;
      systemTokensEst?: number;
      userChars?: number;
      userTokensEst?: number;
      totalChars?: number;
      totalTokensEst?: number;
    }) ?? {};

    const lines = [
      separator,
      `TIMESTAMP   : ${String(timestamp ?? new Date().toISOString())}`,
      `PROVIDER    : ${String(provider ?? 'unknown')} | MODEL: ${String(model ?? 'unknown')} | ATTEMPT: ${String(attempt ?? 1)}/${String(maxRetries ?? 1)}`,
      `DIAGNOSTICS :`,
      `  • System Prompt : ${diag.systemChars ?? 0} chars (~${diag.systemTokensEst ?? 0} estimated tokens)`,
      `  • User Prompt   : ${diag.userChars ?? 0} chars (~${diag.userTokensEst ?? 0} estimated tokens)`,
      `  • Total Input   : ${diag.totalChars ?? 0} chars (~${diag.totalTokensEst ?? 0} estimated tokens)`,
      subSeparator,
      `--- [SYSTEM PROMPT] ---`,
      String(systemPrompt ?? '(empty)'),
      ``,
      `--- [USER PROMPT] ---`,
      String(userPrompt ?? '(empty)'),
      ``,
      separator,
      `\n`,
    ];

    return lines.join('\n');
  });

  const promptRotateTransport = new DailyRotateFile({
    dirname: PROMPTS_DIR,
    filename: 'llm-prompt-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.combine(
      winston.format.timestamp(),
      promptTextFormat,
    ),
  });

  promptLoggerInstance = winston.createLogger({
    level: 'info',
    transports: [promptRotateTransport],
  });

  appLoggerInstance = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    ),
    transports: [
      new DailyRotateFile({
        dirname: path.join(LOGS_DIR, 'app'),
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
      }),
      new DailyRotateFile({
        level: 'error',
        dirname: path.join(LOGS_DIR, 'app'),
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }: { timestamp?: string; level?: string; message?: string; stack?: string }) => {
            return `[${String(timestamp)}] [${String(level)}] ${String(stack ?? message)}`;
          }),
        ),
      }),
    ],
  });

  isWinstonReady = true;
} catch {
  isWinstonReady = false;
  console.warn('[Logger] ⚠️ Winston logging library unavailable or failed to initialize. Falling back to terminal-only logging.');
}

export const promptLogger = promptLoggerInstance;
export const appLogger = appLoggerInstance;

/**
 * Estimate token count from character count (~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Log LLM prompt to Winston rotated file and console diagnostics.
 * Gracefully degrades if the logging library is missing or encounters any filesystem error.
 */
export function logLlmPrompt(
  config: LlmProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  attempt = 1,
  options?: PromptLogOptions,
): void {
  try {
    const isEnabled = options?.enableFileLog ?? (
      process.env.LOG_LLM_PROMPTS === 'true' ||
      process.env.NODE_ENV !== 'production' ||
      options?.logFilePath != null
    );

    if (!isEnabled) return;

    if (!isWinstonReady) {
      console.warn('[LLM] ⚠️ Thư viện ghi log (Winston) chưa sẵn sàng hoặc không khả dụng. Log prompt vào file sẽ không được ghi.');
      return;
    }

    const systemChars = systemPrompt.length;
    const systemTokensEst = estimateTokens(systemPrompt);
    const userChars = userPrompt.length;
    const userTokensEst = estimateTokens(userPrompt);
    const totalChars = systemChars + userChars;
    const totalTokensEst = systemTokensEst + userTokensEst;

    promptLogger.info('LLM Request Prompt', {
      provider: config.name,
      model: config.model,
      attempt,
      maxRetries: config.maxRetries,
      systemPrompt,
      userPrompt,
      diagnostics: {
        systemChars,
        systemTokensEst,
        userChars,
        userTokensEst,
        totalChars,
        totalTokensEst,
      },
    });

    console.log(
      `[LLM] 📝 Prompt logged to Winston daily file (logs/prompts/llm-prompt-*.log) | ~${totalTokensEst} estimated tokens (${totalChars} chars)`,
    );
  } catch (error) {
    console.warn('[LLM] ⚠️ Ghi log prompt thất bại (bỏ qua để không ảnh hưởng ứng dụng):', error instanceof Error ? error.message : error);
  }
}
