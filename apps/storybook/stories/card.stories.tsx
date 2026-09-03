import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@nessa-ui/react"

import { storyDocumentation } from "./story-documentation"

const meta = {
  title: "Primitives/Card",
  component: Card,
  subcomponents: {
    CardHeader,
    CardTitle,
    CardDescription,
    CardAction,
    CardContent,
    CardFooter,
  },
  tags: ["autodocs", "test"],
  parameters: {
    docs: {
      description: {
        component:
          "A composable surface for grouping related content and actions. Card is a shadcn-style family of layout primitives rather than a single rigid template: combine Header, Title, Description, Action, Content, and Footer only when those regions are meaningful.",
      },
    },
  },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  parameters: storyDocumentation(
    "A complete Card composition with supporting metadata and a clear primary action.",
  ),
  render: () => (
    <Card className="w-[360px]">
      <CardHeader>
        <CardTitle>Invite your team</CardTitle>
        <CardDescription>Collaborate in one shared Nessa workspace.</CardDescription>
        <CardAction>
          <Badge variant="secondary">Team</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Members can use the same components, tokens, and interaction patterns.
        </p>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Not now</Button>
        <Button>Invite</Button>
      </CardFooter>
    </Card>
  ),
}
