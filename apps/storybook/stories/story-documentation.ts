export function storyDocumentation(description: string) {
  return {
    docs: {
      description: {
        story: description,
      },
    },
  } as const
}
