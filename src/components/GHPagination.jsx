import React from 'react';
import { RiArrowRightSLine, RiArrowLeftSLine } from 'react-icons/ri';

const GHPagination = ({ currentPage, lastPage, total, onPageChange }) => {
  if (lastPage <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(lastPage, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB',
          background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
          opacity: currentPage === 1 ? 0.5 : 1, display: 'flex', alignItems: 'center'
        }}
      >
        <RiArrowRightSLine size={18} />
      </button>

      {startPage > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid #E5E7EB',
              background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500
            }}
          >
            1
          </button>
          {startPage > 2 && <span style={{ color: '#9CA3AF' }}>...</span>}
        </>
      )}

      {pages.map(page => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          style={{
            padding: '6px 12px', borderRadius: '6px',
            border: page === currentPage ? '1px solid var(--primary-color, #4A0E1B)' : '1px solid #E5E7EB',
            background: page === currentPage ? 'var(--primary-color, #4A0E1B)' : '#fff',
            color: page === currentPage ? '#fff' : '#374151',
            cursor: 'pointer', fontSize: '13px', fontWeight: page === currentPage ? 700 : 500
          }}
        >
          {page}
        </button>
      ))}

      {endPage < lastPage && (
        <>
          {endPage < lastPage - 1 && <span style={{ color: '#9CA3AF' }}>...</span>}
          <button
            onClick={() => onPageChange(lastPage)}
            style={{
              padding: '6px 12px', borderRadius: '6px', border: '1px solid #E5E7EB',
              background: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500
            }}
          >
            {lastPage}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === lastPage}
        style={{
          padding: '6px 8px', borderRadius: '6px', border: '1px solid #E5E7EB',
          background: '#fff', cursor: currentPage === lastPage ? 'not-allowed' : 'pointer',
          opacity: currentPage === lastPage ? 0.5 : 1, display: 'flex', alignItems: 'center'
        }}
      >
        <RiArrowLeftSLine size={18} />
      </button>
    </div>
  );
};

export default GHPagination;
