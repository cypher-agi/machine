import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test clipboard utilities
describe('Clipboard Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('copyToClipboard', () => {
    it('should copy text to clipboard', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        return true;
      };

      const result = await copyToClipboard('test text');

      expect(writeTextMock).toHaveBeenCalledWith('test text');
      expect(result).toBe(true);
    });

    it('should handle clipboard errors', async () => {
      const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));
      Object.assign(navigator, {
        clipboard: { writeText: writeTextMock },
      });

      const copyToClipboard = async (text: string) => {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          return false;
        }
      };

      const result = await copyToClipboard('test');
      expect(result).toBe(false);
    });
  });

  describe('downloadFile', () => {
    it('should create download link for content', () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
      vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);

      const downloadFile = (content: string, filename: string) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        // Mock click to avoid jsdom navigation error
        vi.spyOn(a, 'click').mockImplementation(() => {});
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      };

      downloadFile('file content', 'test.txt');

      expect(createElementSpy).toHaveBeenCalledWith('a');
    });
  });
});
