import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { className?: string }

function SvgIcon({
  src,
  className,
  viewBox = '0 0 24 24',
}: {
  src: string
  className?: string
  viewBox?: string
}) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true">
      <image href={src} width="24" height="24" preserveAspectRatio="xMidYMid meet" />
    </svg>
  )
}

export function User(props: IconProps) {
  return <SvgIcon src="/design/icons/plus.svg" className={props.className} />
}

export function Heart(props: IconProps) {
  return <SvgIcon src="/design/icons/health.svg" className={props.className} />
}

export function Apple(props: IconProps) {
  return <SvgIcon src="/design/icons/food.svg" className={props.className} />
}

export function Dumbbell(props: IconProps) {
  return <SvgIcon src="/design/icons/gym.svg" className={props.className} />
}

export function Brain(props: IconProps) {
  return <SvgIcon src="/design/icons/mental.svg" className={props.className} />
}

export function Target(props: IconProps) {
  return <SvgIcon src="/design/icons/idea.svg" className={props.className} />
}

export function Clock(props: IconProps) {
  return <SvgIcon src="/design/icons/cronology.svg" className={props.className} />
}

export function Settings(props: IconProps) {
  return <SvgIcon src="/design/icons/setting.svg" className={props.className} />
}
