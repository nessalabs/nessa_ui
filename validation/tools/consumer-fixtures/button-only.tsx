/**
 * The smallest real consumer: an app that wanted one control.
 *
 * This is the case a broad barrel is most often accused of punishing — the
 * question being whether importing `Button` from the package root drags the
 * rich-content surfaces in with it.
 */
import { Button } from "@nessalabs/ui"

export function App() {
  return <Button variant="secondary">Continue</Button>
}
