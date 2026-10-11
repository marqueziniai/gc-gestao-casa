import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { num, parseNum, round } from '../lib/calc'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]', className)}>{children}</div>
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-teal-700 text-white active:bg-teal-800 hover:bg-teal-800',
  secondary: 'bg-white text-stone-800 border border-stone-300 active:bg-stone-100 hover:bg-stone-50',
  soft: 'bg-teal-50 text-teal-800 active:bg-teal-100 hover:bg-teal-100',
  ghost: 'text-stone-600 active:bg-stone-100 hover:bg-stone-100',
  danger: 'bg-red-600 text-white active:bg-red-700 hover:bg-red-700',
}
export function Button({
  variant = 'primary', className, children, ...rest
}: { variant?: BtnVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none',
        btnStyles[variant],
        className,
      )}
    >
      {children}
    </button>
  )
}

const badgeTones = {
  neutral: 'bg-stone-100 text-stone-600',
  teal: 'bg-teal-50 text-teal-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-sky-50 text-sky-800',
}
export type Tone = keyof typeof badgeTones
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium', badgeTones[tone])}>{children}</span>
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-10 text-center">
      <div className="mb-3 text-stone-400">{icon}</div>
      <p className="font-semibold text-stone-800">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-stone-500">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const viewportBox = () => {
  const vv = window.visualViewport
  return vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight }
}

/**
 * Área realmente visível da tela. No iPhone o teclado não redimensiona a página — ele
 * cobre a parte de baixo. O visualViewport informa o espaço que sobra acima dele.
 */
export function useViewportBox() {
  const [box, setBox] = useState(viewportBox)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setBox(viewportBox())
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => {
      vv.removeEventListener('resize', on)
      vv.removeEventListener('scroll', on)
    }
  }, [])
  return box
}

const isTextField = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'file'].includes((el as HTMLInputElement).type)))

/** true enquanto um campo de texto está em foco (teclado aberto no celular). */
export function useTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const onIn = (e: FocusEvent) => isTextField(e.target) && setTyping(true)
    const onOut = () => setTimeout(() => setTyping(isTextField(document.activeElement)), 50)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])
  // um campo removido da tela (ex.: formulário fechado) nem sempre dispara focusout
  useEffect(() => {
    if (!typing) return
    const t = setInterval(() => !isTextField(document.activeElement) && setTyping(false), 400)
    return () => clearInterval(t)
  }, [typing])
  return typing
}

/** Rola o campo focado para o centro depois que o teclado termina de abrir. */
export const revealOnFocus = (e: React.FocusEvent) => {
  const el = e.target
  if (isTextField(el)) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
}

/** Bottom sheet no celular, diálogo centralizado no desktop. Fica sempre acima do teclado. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  const box = useViewportBox()
  return (
    <div className="fixed inset-x-0 z-50 flex items-end justify-center md:items-center" style={{ top: box.top, height: box.height }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-stone-900/40 animate-[fade_.15s_ease-out]" onClick={onClose} />
      <div className="relative flex max-h-[calc(100%-1.5rem)] w-full flex-col rounded-t-3xl bg-stone-50 shadow-xl animate-[up_.2s_ease-out] md:max-w-lg md:rounded-3xl">
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-5 py-3">
          <h2 className="truncate text-lg font-semibold text-stone-900">{title}</h2>
          <button type="button" onClick={onClose} className="-mr-2 grid size-11 place-items-center rounded-full text-stone-500 hover:bg-stone-200" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-4" onFocus={revealOnFocus}>{children}</div>
        {footer && <div className="border-t border-stone-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'w-full min-h-11 rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20'

/** Campo numérico que aceita vírgula. Guarda o texto enquanto o usuário digita. */
export function NumInput({ value, onChange, placeholder, id, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; id?: string; autoFocus?: boolean }) {
  return (
    <input
      id={id}
      className={inputCls}
      inputMode="decimal"
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
    />
  )
}

/** Stepper − valor +. Toque no valor para digitar a quantidade exata. */
export function Stepper({ value, onChange, step = 1, size = 'md', label }: { value: number; onChange: (n: number) => void; step?: number; size?: 'sm' | 'md'; label?: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!editing || !ref.current) return
    ref.current.select()
    const el = ref.current
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
  }, [editing])
  const commit = () => {
    const n = parseNum(text)
    if (n != null && n >= 0) onChange(round(n))
    setEditing(false)
  }
  const h = size === 'sm' ? 'size-10' : 'size-11'
  const btn = cx(h, 'grid shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-700 active:bg-stone-200 hover:bg-stone-200 disabled:opacity-30')
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, round(value - step)))} disabled={value <= 0} aria-label={`Diminuir${label ? ' ' + label : ''}`}>
        <Minus size={18} />
      </button>
      {editing ? (
        <input
          ref={ref}
          className={cx('w-16 rounded-lg border border-teal-600 bg-white text-center text-base font-semibold outline-none', size === 'sm' ? 'h-10' : 'h-11')}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      ) : (
        <button
          type="button"
          className={cx('min-w-12 rounded-lg px-1 text-center text-base font-semibold tabular-nums text-stone-900 hover:bg-stone-100', size === 'sm' ? 'h-10' : 'h-11')}
          onClick={() => {
            setText(String(value).replace('.', ','))
            setEditing(true)
          }}
          aria-label={`Editar quantidade exata${label ? ' de ' + label : ''}`}
        >
          {num(value)}
        </button>
      )}
      <button type="button" className={btn} onClick={() => onChange(round(value + step))} aria-label={`Aumentar${label ? ' ' + label : ''}`}>
        <Plus size={18} />
      </button>
    </div>
  )
}

export function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'min-h-9 shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
            value === o.value ? 'border-teal-700 bg-teal-700 text-white' : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50',
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <input type="search" className={cx(inputCls, 'pr-10')} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center text-stone-400" aria-label="Limpar busca">
          <X size={16} />
        </button>
      )}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">{children}</h2>
      {action}
    </div>
  )
}

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Seletor Pacote | Unidade. */
export function UnitToggle({ value, onChange, size = 'md' }: { value: 'un' | 'pct'; onChange: (u: 'un' | 'pct') => void; size?: 'sm' | 'md' }) {
  return (
    <div className="flex shrink-0 rounded-xl bg-stone-100 p-0.5" role="radiogroup" aria-label="Unidade">
      {(['pct', 'un'] as const).map((u) => (
        <button
          key={u}
          type="button"
          role="radio"
          aria-checked={value === u}
          onClick={() => onChange(u)}
          className={cx(
            'rounded-[10px] font-medium transition-colors',
            size === 'sm' ? 'min-h-9 px-2.5 text-xs' : 'min-h-10 px-4 text-sm',
            value === u ? 'bg-white text-teal-800 shadow-sm' : 'text-stone-500',
          )}
        >
          {u === 'pct' ? 'Pacote' : 'Unidade'}
        </button>
      ))}
    </div>
  )
}

/** Abas segmentadas de largura total (ex.: escolha do mercado). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex w-max min-w-full rounded-2xl bg-stone-200/70 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx('min-h-10 min-w-[5.5rem] flex-1 truncate rounded-xl px-2 text-sm font-semibold transition-colors', value === o.value ? 'bg-white text-teal-800 shadow-sm' : 'text-stone-600')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
