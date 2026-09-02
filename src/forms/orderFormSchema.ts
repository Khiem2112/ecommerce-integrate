import { z } from 'zod';

export const orderItemSchema = z.object({
  id: z.number().optional(),
  productId: z.string().min(1, 'Mã sản phẩm không được để trống'),
  sku: z.string().nullable().optional(),
  productName: z.string().min(1, 'Tên sản phẩm không được để trống'),
  categoryId: z.number().nullable().optional(),
  quantity: z.number().int().min(1, 'Số lượng phải từ 1 trở lên'),
  unitPrice: z.number().min(0, 'Đơn giá không được âm'),
  discount: z.number().min(0, 'Giảm giá không được âm'),
  refundAmount: z.number().min(0, 'Hoàn tiền không được âm'),
});

/** Full Create Schema */
export const orderFormSchema = z.object({
  id: z.number().optional(),
  platformId: z.number().min(1, 'Vui lòng chọn sàn thương mại điện tử'),
  platformOrderId: z.string().min(1, 'Mã đơn hàng sàn không được để trống'),
  customerId: z.number().min(1, 'Vui lòng chọn khách hàng'),
  currentStatusId: z.number().min(1, 'Vui lòng chọn trạng thái đơn hàng'),
  currency: z.string().min(1, 'Tiền tệ không được để trống'),
  shippingFee: z.number().min(0, 'Phí vận chuyển không được âm'),
  discountAmount: z.number().min(0, 'Tổng giảm giá không được âm'),
  totalValue: z.number().min(0, 'Tổng giá trị đơn hàng không được âm'),
  cancelReturnInitiator: z.enum(['buyer', 'seller', 'system', '']).nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  items: z.array(orderItemSchema).min(1, 'Đơn hàng phải có ít nhất 1 sản phẩm'),
  updatedAt: z.string().optional(),
});

/** Unified Update Schema (Accepts full or partial updates + concurrency check) */
export const orderUpdateSchema = z.object({
  id: z.number().min(1, 'Thiếu mã đơn hàng'),
  platformId: z.number().optional(),
  platformOrderId: z.string().optional(),
  customerId: z.number().optional(),
  currentStatusId: z.number().optional(),
  currency: z.string().optional(),
  shippingFee: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
  totalValue: z.number().min(0).optional(),
  cancelReturnInitiator: z.enum(['buyer', 'seller', 'system', '']).nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  fulfilledAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  items: z.array(orderItemSchema).optional(),
  statusChangeNote: z.string().optional(),
  statusChangedBy: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const orderStatusUpdateSchema = z.object({
  orderId: z.number().min(1, 'Mã đơn hàng không hợp lệ'),
  statusId: z.number().min(1, 'Vui lòng chọn trạng thái mới'),
  changedBy: z.string().min(1, 'Vui lòng nhập người thực hiện'),
  note: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const orderGeneralUpdateSchema = z.object({
  orderId: z.number().min(1, 'Mã đơn hàng không hợp lệ'),
  platformId: z.number().min(1, 'Vui lòng chọn sàn'),
  platformOrderId: z.string().min(1, 'Mã đơn hàng sàn không được để trống'),
  customerId: z.number().min(1, 'Vui lòng chọn khách hàng'),
  currency: z.string().min(1, 'Tiền tệ không được để trống'),
  updatedAt: z.string().optional(),
});

export const orderShippingUpdateSchema = z.object({
  orderId: z.number().min(1, 'Mã đơn hàng không hợp lệ'),
  shippingFee: z.number().min(0, 'Phí vận chuyển không được âm'),
  discountAmount: z.number().min(0, 'Giảm giá không được âm'),
  cancelReturnInitiator: z.enum(['buyer', 'seller', 'system', '']).nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  paidAt: z.string().nullable().optional(),
  fulfilledAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
});

export const addOrderItemSchema = z.object({
  orderId: z.number().min(1, 'Mã đơn hàng không hợp lệ'),
  item: orderItemSchema,
  updatedAt: z.string().optional(),
});

/** Action query/mutation validation schemas */
export const orderFilterSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  keyword: z.string().optional(),
  platformId: z.coerce.number().int().positive().optional(),
  statusId: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['createdAt', 'totalValue', 'platformOrderId']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const getOrderSchema = z.object({
  id: z.number().int().positive('Mã đơn hàng không hợp lệ'),
});

export const deleteOrderSchema = z.object({
  id: z.number().int().positive('Mã đơn hàng không hợp lệ'),
  updatedAt: z.string().optional(),
});

export const deleteOrderItemSchema = z.object({
  orderId: z.number().int().positive('Mã đơn hàng không hợp lệ'),
  itemId: z.number().int().positive('Mã sản phẩm không hợp lệ'),
  updatedAt: z.string().optional(),
});

export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
export type OrderFormValues = z.infer<typeof orderFormSchema>;
export type OrderUpdateInput = z.infer<typeof orderUpdateSchema>;
export type OrderStatusUpdateValues = z.infer<typeof orderStatusUpdateSchema>;
export type OrderGeneralUpdateValues = z.infer<typeof orderGeneralUpdateSchema>;
export type OrderShippingUpdateValues = z.infer<typeof orderShippingUpdateSchema>;
export type AddOrderItemValues = z.infer<typeof addOrderItemSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type DeleteOrderItemInput = z.infer<typeof deleteOrderItemSchema>;
