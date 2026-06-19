// アップロードされたファイルを、テキスト抽出せずにそのまま Gemini API の parts に変換する。
// PDF は inlineData（base64）として、テキストファイルはそのままテキストとして渡す。
export function buildContentBlocks(files) {
  return files.map((file) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      return {
        inlineData: {
          mimeType: "application/pdf",
          data: file.buffer.toString("base64"),
        },
      };
    }
    return {
      text: `【${file.originalname}】\n${file.buffer.toString("utf-8")}`,
    };
  });
}

export function fileNames(files) {
  return files.map((f) => f.originalname);
}
