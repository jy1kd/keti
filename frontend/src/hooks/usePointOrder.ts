interface PointOrderPayload {
  instrumentID: string
  price: number
}

interface UsePointOrderOptions {
  onOrder?: (payload: PointOrderPayload) => void
  onFill?: (payload: PointOrderPayload) => void
}

export function usePointOrder(options?: UsePointOrderOptions) {
  const handleClick = (instrumentID: string, price: number) => {
    options?.onOrder?.({ instrumentID, price })
  }

  const handleDoubleClick = (instrumentID: string, price: number) => {
    options?.onFill?.({ instrumentID, price })
  }

  return { handleClick, handleDoubleClick }
}
