import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface UseModalFocusTrapOptions {
  isOpen: boolean;
  onClose: () => void;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocusTrap({
  isOpen,
  onClose,
  containerRef,
  initialFocusRef,
}: UseModalFocusTrapOptions): {
  setTriggerElement: (element: HTMLElement | null) => void;
} {
  const triggerRef = useRef<HTMLElement | null>(null);

  const setTriggerElement = (element: HTMLElement | null): void => {
    triggerRef.current = element;
  };

  useEffect(() => {
    if (!isOpen) return;

    if (triggerRef.current === null && document.activeElement instanceof HTMLElement) {
      triggerRef.current = document.activeElement;
    }

    const previousTrigger = triggerRef.current;

    // Foco inicial
    const focusTimer = setTimeout(() => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
      } else if (containerRef.current) {
        const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        if (firstFocusable) {
          firstFocusable.focus();
        } else {
          containerRef.current.focus();
        }
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!containerRef.current) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');

        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement || !containerRef.current.contains(document.activeElement)) {
            lastElement?.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement || !containerRef.current.contains(document.activeElement)) {
            firstElement?.focus();
            event.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previousTrigger && typeof previousTrigger.focus === 'function') {
        previousTrigger.focus();
      }
      triggerRef.current = null;
    };
  }, [isOpen, onClose, containerRef, initialFocusRef]);

  return { setTriggerElement };
}
