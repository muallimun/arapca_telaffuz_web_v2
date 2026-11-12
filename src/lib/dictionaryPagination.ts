export type ItemsPerPageOption = 25 | 50 | 100 | 500 | "all";

export const ITEMS_PER_PAGE_OPTIONS: {
  value: ItemsPerPageOption;
  label: string;
}[] = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
  { value: 500, label: "500" },
  { value: "all", label: "Tümü" },
];

export const DEFAULT_ITEMS_PER_PAGE: ItemsPerPageOption = 50;

export type PaginationToken = number | "ellipsis-left" | "ellipsis-right";

export interface PaginationComputation<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  startIndex: number;
  endIndex: number;
  tokens: PaginationToken[];
}

/**
 * Mobil ve masaüstünde taşma yapmayan akıllı sayfa numarası dizisi üretir:
 * Örn: [1, 2, 3, 4, 5, "ellipsis-right", 67] veya [1, "ellipsis-left", 14, 15, 16, "ellipsis-right", 67]
 */
export function buildPaginationTokens(
  currentPage: number,
  totalPages: number
): PaginationToken[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const safeCurrent = Math.min(Math.max(1, currentPage), totalPages);

  if (safeCurrent <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-right", totalPages];
  }

  if (safeCurrent >= totalPages - 3) {
    return [
      1,
      "ellipsis-left",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [
    1,
    "ellipsis-left",
    safeCurrent - 1,
    safeCurrent,
    safeCurrent + 1,
    "ellipsis-right",
    totalPages,
  ];
}

/**
 * Verilen filtrelenmiş diziyi seçili sayfa ve sayfa başına kayıt sayısına göre dilimler (slice).
 */
export function paginateDictionaryItems<T>(
  allItems: T[],
  requestedPage: number,
  itemsPerPage: ItemsPerPageOption
): PaginationComputation<T> {
  const totalItems = allItems.length;

  if (totalItems === 0) {
    return {
      items: [],
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
      startIndex: 0,
      endIndex: 0,
      tokens: [1],
    };
  }

  if (itemsPerPage === "all") {
    return {
      items: allItems,
      totalItems,
      totalPages: 1,
      currentPage: 1,
      startIndex: 0,
      endIndex: totalItems,
      tokens: [1],
    };
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(totalItems, startIndex + itemsPerPage);
  const items = allItems.slice(startIndex, endIndex);
  const tokens = buildPaginationTokens(currentPage, totalPages);

  return {
    items,
    totalItems,
    totalPages,
    currentPage,
    startIndex,
    endIndex,
    tokens,
  };
}
