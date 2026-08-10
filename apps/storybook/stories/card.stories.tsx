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

const meta = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs", "test"],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
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

