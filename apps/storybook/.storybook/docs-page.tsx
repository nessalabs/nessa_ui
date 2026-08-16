import {
  Controls,
  Description,
  Primary,
  Stories,
  Subtitle,
  Title,
  useOf,
} from "@storybook/addon-docs/blocks"

function NessaDocsPage() {
  const { csfFile } = useOf("meta", ["meta"])
  const hasMultipleStories = Object.keys(csfFile.stories).length > 1

  return (
    <>
      <Title />
      <Subtitle />
      <Description of="meta" />
      <Description of="story" />
      <Primary />
      <Controls />
      {hasMultipleStories && <Stories />}
    </>
  )
}

export { NessaDocsPage }
