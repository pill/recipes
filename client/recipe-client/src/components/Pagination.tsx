interface PaginationProps {
  currentPage: number
  totalResults: number
  pageSize: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalResults, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalResults / pageSize)
  
  if (totalPages <= 1) return null

  const pages = []
  const maxVisiblePages = 7
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push(-1)
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 2) {
      pages.push(1)
      pages.push(-1)
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push(-1)
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
      pages.push(-1)
      pages.push(totalPages)
    }
  }

  return (
    <div style={{ 
      display: 'flex', 
      gap: '0.5rem', 
      justifyContent: 'center', 
      alignItems: 'center',
      marginTop: '2rem',
      marginBottom: '1rem'
    }}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        style={{ padding: '0.5rem 1rem' }}
      >
        Previous
      </button>
      
      {pages.map((page, index) => 
        page === -1 ? (
          <span key={`ellipsis-${index}`} style={{ padding: '0 0.25rem' }}>...</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            disabled={page === currentPage}
            style={{
              padding: '0.5rem 0.75rem',
              fontWeight: page === currentPage ? 'bold' : 'normal',
              backgroundColor: page === currentPage ? '#646cff' : undefined,
            }}
          >
            {page}
          </button>
        )
      )}
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        style={{ padding: '0.5rem 1rem' }}
      >
        Next
      </button>
      
      <span style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#888' }}>
        Page {currentPage} of {totalPages} ({totalResults} total)
      </span>
    </div>
  )
}

