/**
 * Метаданные продуктов профиля: подписи и цвета.
 * Цвета — из дизайн-токенов палитры (styles.md): нефть/газ/вода/жидкость.
 */
import type { ProductType } from '../../domain/types';

export const PRODUCT_LABEL: Record<ProductType, string> = {
  oil: 'Нефть',
  gas: 'Газ',
  water: 'Вода',
  liquid: 'Жидкость',
};

/** Цвет-маркер продукта (совпадает с палитрой подписей в макете). */
export const PRODUCT_COLOR: Record<ProductType, string> = {
  oil: '#2e5f8a',
  gas: '#10b981',
  water: '#0ea5e9',
  liquid: '#7c3aed',
};
