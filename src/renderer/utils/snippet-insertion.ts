// Monaco normalizes inserted line endings to the target model's EOL.
export const normalizedSnippetLength = (text: string, eol: string): number => text.replace(/\r\n|\r|\n/g, eol).length
