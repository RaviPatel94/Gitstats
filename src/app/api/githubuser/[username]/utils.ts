export const apiLogger = {
  log: (message: unknown) => console.log(message),
  error: (message: unknown, error?: unknown) => {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  },
};

export const wrapTextInLines = (text: string, width: number, indent: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = " ".repeat(indent);
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine.trim() ? " " : "") + word;
    } else {
      lines.push(currentLine);
      currentLine = " ".repeat(indent) + word;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }
  return lines;
};

export const retryApiCall = async <T>(
  fetcherFunction: (variables: Record<string, string>, token: string) => Promise<T>,
  variables: Record<string, string>,
  token?: string,
  maxRetries = 2
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetcherFunction(variables, token || process.env.GITHUB_TOKEN || '');
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, i)));
    }
  }
  throw new Error("Max retries exceeded");
};
