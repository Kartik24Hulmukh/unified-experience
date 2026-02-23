import { useState, useEffect } from 'react';

/**
 * useTypewriter — Progressively reveals lines of text character‑by‑character.
 *
 * @param lines     Array of strings to reveal sequentially
 * @param speed     Delay in ms between characters
 * @param lineDelay Delay in ms between finishing one line and starting the next
 * @param startDelay Delay in ms before the first character appears
 */
export function useTypewriter(
  lines: string[],
  speed = 30,
  lineDelay = 200,
  startDelay = 1500,
) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(timeout);
  }, [startDelay]);

  useEffect(() => {
    if (!started) return;
    if (currentLine >= lines.length) return;

    const line = lines[currentLine];

    if (currentChar <= line.length) {
      const timeout = setTimeout(() => {
        setDisplayedLines((prev) => {
          const newLines = [...prev];
          newLines[currentLine] = line.slice(0, currentChar);
          return newLines;
        });
        setCurrentChar((c) => c + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setCurrentLine((l) => l + 1);
        setCurrentChar(0);
      }, lineDelay);
      return () => clearTimeout(timeout);
    }
  }, [started, currentLine, currentChar, lines, speed, lineDelay]);

  return { displayedLines, isComplete: currentLine >= lines.length };
}
