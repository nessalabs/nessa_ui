import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"
import {
  Button,
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireHeader,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
  cn,
} from "@nessalabs/ui"

import { storyDocumentation } from "./story-documentation"

/** Shared story chrome so every example frames its questionnaire identically. */
function StoryFrame({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Story-local form wrapper: submits stay on the page while the questionnaire
 * keeps real form semantics (FormData, Enter-to-submit).
 */
function StoryForm({ children }: { children: React.ReactNode }) {
  return <form onSubmit={(event) => event.preventDefault()}>{children}</form>
}

/** Reads the drawn check glyph inside a choice's indicator. */
function checkGlyph(input: HTMLElement) {
  return input
    .closest('[data-slot="questionnaire-choice-indicator"]')
    ?.querySelector<SVGSVGElement>('[data-slot="questionnaire-choice-check"]')
}

const meta = {
  title: "Conversation/Questionnaire",
  component: Questionnaire,
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A composable question-flow surface for agent onboarding, feedback asks, and structured intake. Hosts stack a QuestionnaireHeader — with the batteries-included QuestionnaireProgress step counter or progress bar, or any custom chrome — above QuestionnaireItems, and close with a QuestionnaireActions row holding navigation and the QuestionnaireSubmit button. Each item is a real fieldset titled by its legend; answers come from QuestionnaireChoices (native radios or checkboxes under custom check indicators, single or multiple selection) and QuestionnaireInput for freeform text, and a wrapping form receives every answer as FormData.",
      },
    },
  },
} satisfies Meta<typeof Questionnaire>

export default meta
type Story = StoryObj<typeof meta>

export const SingleChoice: Story = {
  parameters: storyDocumentation(
    "A single-selection question under a 'Question 1 of 2' step counter, wrapped in a form and finished with a QuestionnaireActions row holding the submit button. The choices are native radios — arrow keys move within the group, and clicking anywhere on a row selects it — drawn as circular indicators that fill with a translucent primary wash and a check when selected. The play test proves selection is exclusive by computed check-glyph opacity, not class names.",
  ),
  render: () => (
    <StoryFrame>
      <StoryForm>
        <Questionnaire>
          <QuestionnaireHeader>
            <QuestionnaireProgress step={1} total={2} />
          </QuestionnaireHeader>
          <QuestionnaireItem name="role">
            <QuestionnaireTitle>
              What best describes your role?
            </QuestionnaireTitle>
            <QuestionnaireDescription>
              We tune the default workspace to how you work.
            </QuestionnaireDescription>
            <QuestionnaireChoices defaultValue={["design-engineer"]}>
              <QuestionnaireChoice value="design-engineer">
                Design engineer
              </QuestionnaireChoice>
              <QuestionnaireChoice value="product-engineer">
                Product engineer
              </QuestionnaireChoice>
              <QuestionnaireChoice value="researcher">
                Researcher
              </QuestionnaireChoice>
              <QuestionnaireChoice value="something-else">
                Something else
              </QuestionnaireChoice>
            </QuestionnaireChoices>
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnaireSubmit />
          </QuestionnaireActions>
        </Questionnaire>
      </StoryForm>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const preselected = canvas.getByRole("radio", { name: "Design engineer" })
    const researcher = canvas.getByRole("radio", { name: "Researcher" })

    // Single selection renders circular radio indicators (rounded-full is
    // calc(infinity * 1px), which computes to a huge pixel value).
    await expect(
      Number.parseFloat(getComputedStyle(preselected).borderRadius),
    ).toBeGreaterThan(1000)
    await expect(preselected).toBeChecked()
    const preselectedGlyph = checkGlyph(preselected)!
    await expect(getComputedStyle(preselectedGlyph).opacity).toBe("1")

    await userEvent.click(canvas.getByText("Researcher"))
    await expect(researcher).toBeChecked()
    await expect(preselected).not.toBeChecked()
    // The check glyph swaps by computed opacity (transition-opacity settles).
    await waitFor(async () => {
      await expect(getComputedStyle(checkGlyph(researcher)!).opacity).toBe("1")
      await expect(getComputedStyle(preselectedGlyph).opacity).toBe("0")
    })
    const checked = canvas
      .getAllByRole("radio")
      .filter((candidate) => (candidate as HTMLInputElement).checked)
    await expect(checked).toHaveLength(1)

    // The actions row closes the flow with a real submit control.
    const submit = canvas.getByRole("button", { name: "Submit" })
    await expect(submit).toHaveAttribute("type", "submit")
  },
}

export const MultipleChoice: Story = {
  parameters: storyDocumentation(
    "A multiple-selection question under the bar variant of QuestionnaireProgress, closed by the actions row's submit button. The multiple flag on QuestionnaireChoices switches the native inputs to checkboxes — indicators become rounded squares, matching the kit's check-in-a-box glyph — and every toggle reports the full selection through onValueChange. The play test toggles rows on and off and asserts the drawn check by computed opacity.",
  ),
  render: () => (
    <StoryFrame>
      <StoryForm>
        <Questionnaire>
          <QuestionnaireHeader>
            <QuestionnaireProgress variant="bar" step={2} total={2} />
          </QuestionnaireHeader>
          <QuestionnaireItem name="surfaces">
            <QuestionnaireTitle>
              Which surfaces do you build for?
            </QuestionnaireTitle>
            <QuestionnaireDescription>
              Pick every one that applies.
            </QuestionnaireDescription>
            <QuestionnaireChoices multiple defaultValue={["web"]}>
              <QuestionnaireChoice value="web">Web</QuestionnaireChoice>
              <QuestionnaireChoice value="desktop">Desktop</QuestionnaireChoice>
              <QuestionnaireChoice value="mobile">Mobile</QuestionnaireChoice>
              <QuestionnaireChoice value="terminal">
                Terminal
              </QuestionnaireChoice>
            </QuestionnaireChoices>
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnaireSubmit />
          </QuestionnaireActions>
        </Questionnaire>
      </StoryForm>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const web = canvas.getByRole("checkbox", { name: "Web" })
    const desktop = canvas.getByRole("checkbox", { name: "Desktop" })

    // Multiple selection renders rounded-square checkbox indicators.
    await expect(getComputedStyle(web).borderRadius).toBe("5px")
    await expect(web).toBeChecked()

    await userEvent.click(canvas.getByText("Desktop"))
    await expect(desktop).toBeChecked()
    // Multiple selection keeps prior answers checked.
    await expect(web).toBeChecked()
    await waitFor(async () => {
      await expect(getComputedStyle(checkGlyph(desktop)!).opacity).toBe("1")
    })

    // Checkboxes toggle off, clearing the drawn check.
    await userEvent.click(canvas.getByText("Web"))
    await expect(web).not.toBeChecked()
    await waitFor(async () => {
      await expect(getComputedStyle(checkGlyph(web)!).opacity).toBe("0")
    })

    const bar = canvas.getByRole("progressbar", { name: "Question 2 of 2" })
    await expect(getComputedStyle(bar).overflowX).toBe("hidden")
    await expect(
      canvas.getByRole("button", { name: "Submit" }),
    ).toHaveAttribute("type", "submit")
  },
}

export const TextAnswer: Story = {
  parameters: storyDocumentation(
    "A freeform question answered through QuestionnaireInput — the library Input wired to the item's field name for form submission — and closed by the submit button in the actions row. The item legend names the group, so the input carries its own accessible name via aria-label. The play test types an answer, asserts the value and the input's questionnaire slot wiring, and submits without leaving the page.",
  ),
  render: () => (
    <StoryFrame>
      <StoryForm>
        <Questionnaire>
          <QuestionnaireHeader>
            <QuestionnaireProgress step={2} total={2} />
          </QuestionnaireHeader>
          <QuestionnaireItem name="stack">
            <QuestionnaireTitle>
              What does your current stack look like?
            </QuestionnaireTitle>
            <QuestionnaireDescription>
              Frameworks, runtimes, anything you reach for daily.
            </QuestionnaireDescription>
            <QuestionnaireInput
              aria-label="Current stack"
              placeholder="React, Tailwind, tRPC…"
            />
          </QuestionnaireItem>
          <QuestionnaireActions>
            <QuestionnaireSubmit />
          </QuestionnaireActions>
        </Questionnaire>
      </StoryForm>
    </StoryFrame>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole("textbox", { name: "Current stack" })
    // The freeform input inherits the item's field name for FormData and
    // exposes the questionnaire slot for host styling.
    await expect(input).toHaveAttribute("name", "stack")
    await expect(input).toHaveAttribute("data-slot", "questionnaire-input")
    await userEvent.type(input, "React and Tailwind")
    await expect(input).toHaveValue("React and Tailwind")

    // Submitting keeps the answer in place (the story form stays on-page).
    await userEvent.click(canvas.getByRole("button", { name: "Submit" }))
    await expect(input).toHaveValue("React and Tailwind")
  },
}

export const ComposedFlow: Story = {
  parameters: storyDocumentation(
    "Two questions composed into a stepped flow — the host owns the step and answer state while the questionnaire renders the active question, exactly the composition contract of the kit. The choices are controlled (value + onValueChange lifted to the host) so navigating Back preserves the answer instead of remounting to the default, and the actions row swaps Continue for the submit button on the final step. The play test answers question one, advances, asserts the counter re-announces 'Question 2 of 2' and the submit appears, then returns to prove the answer survived.",
  ),
  render: function ComposedFlowStory() {
    const [step, setStep] = React.useState(1)
    const [teamSize, setTeamSize] = React.useState<string[]>(["2-10"])
    return (
      <StoryFrame>
        <StoryForm>
          <Questionnaire>
            <QuestionnaireHeader>
              <QuestionnaireProgress step={step} total={2} />
              <QuestionnaireProgress
                variant="bar"
                step={step}
                total={2}
                label={`Progress: question ${step} of 2`}
                className="max-w-24"
              />
            </QuestionnaireHeader>
            {step === 1 ? (
              <QuestionnaireItem name="team-size">
                <QuestionnaireTitle>How big is your team?</QuestionnaireTitle>
                <QuestionnaireChoices
                  value={teamSize}
                  onValueChange={setTeamSize}
                >
                  <QuestionnaireChoice value="solo">
                    Just me
                  </QuestionnaireChoice>
                  <QuestionnaireChoice value="2-10">
                    2–10 people
                  </QuestionnaireChoice>
                  <QuestionnaireChoice value="11-plus">
                    More than 10
                  </QuestionnaireChoice>
                </QuestionnaireChoices>
              </QuestionnaireItem>
            ) : (
              <QuestionnaireItem name="hear-about">
                <QuestionnaireTitle>
                  How did you hear about us?
                </QuestionnaireTitle>
                <QuestionnaireInput
                  aria-label="How you heard about us"
                  placeholder="A friend, a launch post…"
                />
              </QuestionnaireItem>
            )}
            <QuestionnaireActions>
              {step > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </Button>
              ) : null}
              {step === 2 ? (
                <QuestionnaireSubmit />
              ) : (
                <Button type="button" onClick={() => setStep(step + 1)}>
                  Continue
                </Button>
              )}
            </QuestionnaireActions>
          </Questionnaire>
        </StoryForm>
      </StoryFrame>
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByRole("progressbar", { name: "Question 1 of 2" }),
    ).toBeVisible()
    await userEvent.click(canvas.getByText("More than 10"))
    await expect(
      canvas.getByRole("radio", { name: "More than 10" }),
    ).toBeChecked()

    await userEvent.click(canvas.getByRole("button", { name: "Continue" }))
    const counter = canvas.getByRole("progressbar", {
      name: "Question 2 of 2",
    })
    await expect(counter).toHaveTextContent("Question 2 of 2")
    // The bar variant reflects the same step through its accessible value.
    const bar = canvas.getByRole("progressbar", {
      name: "Progress: question 2 of 2",
    })
    await expect(bar).toHaveAttribute("aria-valuenow", "2")
    await expect(
      canvas.getByRole("textbox", { name: "How you heard about us" }),
    ).toBeVisible()
    // The final step trades Continue for the submit control.
    await expect(
      canvas.getByRole("button", { name: "Submit" }),
    ).toHaveAttribute("type", "submit")

    // Navigating back must not lose the answer: the host controls the
    // selection, so the remounted group re-renders the chosen value.
    await userEvent.click(canvas.getByRole("button", { name: "Back" }))
    await expect(
      canvas.getByRole("radio", { name: "More than 10" }),
    ).toBeChecked()
  },
}
