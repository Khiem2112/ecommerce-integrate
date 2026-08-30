'use client';

import {
  Autocomplete,
  type AutocompleteOption,
  type AutocompleteProps,
} from '@/components/atoms/Autocomplete/Autocomplete';

export type ComboboxItem = AutocompleteOption;

export type ComboboxProps = Omit<AutocompleteProps, 'options'> & {
  readonly items: readonly ComboboxItem[];
};

export function Combobox({ items, ...restProps }: ComboboxProps) {
  return <Autocomplete options={items} {...restProps} />;
}
