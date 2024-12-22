export const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true; // 성공 시 true 반환
    } catch (error) {
      return false; // 실패 시 false 반환
    }
};
  