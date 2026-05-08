import { Fragment, ReactNode } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { X } from 'lucide-react'

export function Modal({
  open, onClose, title, children, maxWidth = 'sm',
}: {
  open:      boolean
  onClose:   () => void
  title:     string
  children:  ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const widthCls = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }[maxWidth]

  return (
    <Transition appear show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={`w-full ${widthCls} rounded-2xl bg-white p-6 shadow-xl`}>
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-base font-semibold text-slate-800">
                    {title}
                  </Dialog.Title>
                  <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
