import { cardImageSrc } from './cardImages'

interface Props {
  cardId: string | null | undefined
  clan?: unknown  // 保留參數相容性，不再使用
  faceDown?: boolean
  className?: string
}

export default function CardImage({ cardId, faceDown, className = '' }: Props) {
  if (faceDown) {
    return (
      <div className={`card-img card-img--facedown ${className}`}>
        <span className="card-img__facedown-icon">?</span>
      </div>
    )
  }

  const src = cardImageSrc(cardId)

  if (!src) {
    return <div className={`card-img card-img--empty ${className}`} />
  }

  return (
    <img
      className={`card-img ${className}`}
      src={src}
      alt={cardId ?? ''}
      draggable={false}
      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}
