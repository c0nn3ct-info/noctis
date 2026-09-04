import { useEffect } from 'react';
import type { Decorator } from '@storybook/react-vite';

// Story-only clipboard double.
//
// `CodeBlock` has two states worth showing — copied, and "your browser blocked
// the clipboard" — and neither is reachable from a story on its own. The real
// `navigator.clipboard.writeText` rejects inside a Storybook iframe unless the
// click that triggered it counts as user activation for the *top* document, so
// the success path would never appear and the failure path would appear by
// accident rather than by design. Swapping the API out makes each state a
// deliberate story instead of a property of the browser the docs are open in.
//
// `withClipboardOutcome`, not `withClipboard`: the extension carries a decorator
// of that name with a different contract (it takes the text the clipboard should
// already hold and returns a `{ loader, decorator }` pair), and the two packages
// sit side by side in the composed shell.
//
// `Object.defineProperty` with `configurable: true`: `clipboard` is a getter on
// `Navigator.prototype`, so a plain assignment is a no-op. The own property
// defined here shadows it, and deleting it on cleanup uncovers the real getter
// again — stories that follow this one in the same iframe see the real API.
export function withClipboardOutcome(
  mode: 'ok' | 'fail',
  /**
   * Called with each payload handed to the stub, so a play function can assert
   * what actually reached the clipboard rather than only that the button
   * changed. Pass `fn()` from `storybook/test`; the default records nothing.
   */
  writeText: (text: string) => void = () => {},
): Decorator {
  return function WithClipboardOutcome(Story) {
    useEffect(() => {
      const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            writeText(text);
            return mode === 'ok'
              ? Promise.resolve()
              : Promise.reject(new Error('clipboard blocked by the story'));
          },
        },
      });
      return () => {
        if (own) Object.defineProperty(navigator, 'clipboard', own);
        else Reflect.deleteProperty(navigator, 'clipboard');
      };
    }, []);

    return <Story />;
  };
}
