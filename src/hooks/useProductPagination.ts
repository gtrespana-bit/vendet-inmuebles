'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseProductPaginationProps {
  itemsPerPage?: number;
  initialPage?: number;
}

export const useProductPagination = ({
  itemsPerPage = 24,
  initialPage = 1
}: UseProductPaginationProps = {}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPageState] = useState(itemsPerPage);

  // Actualizar página cuando cambia el parámetro de búsqueda
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get('pagina');
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    
    if (!isNaN(page) && page > 0) {
      setCurrentPage(page);
    }
  }, []);

  const goToPage = useCallback((page: number) => {
    if (page < 1) return;
    
    // Actualizar URL
    const url = new URL(window.location.href);
    if (page === 1) {
      url.searchParams.delete('pagina');
    } else {
      url.searchParams.set('pagina', page.toString());
    }
    
    window.history.pushState({}, '', url.toString());
    setCurrentPage(page);
  }, []);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(Math.max(1, currentPage - 1));
  }, [currentPage, goToPage]);

  const calculatePagination = useCallback((
    totalItems: number
  ) => {
    const totalPages = Math.ceil(totalItems / itemsPerPageState);
    const startIndex = (currentPage - 1) * itemsPerPageState;
    const endIndex = Math.min(startIndex + itemsPerPageState, totalItems);
    
    return {
      currentPage,
      totalPages,
      itemsPerPage: itemsPerPageState,
      totalItems,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [currentPage, itemsPerPageState]);

  return {
    currentPage,
    itemsPerPage: itemsPerPageState,
    goToPage,
    nextPage,
    prevPage,
    calculatePagination
  };
};