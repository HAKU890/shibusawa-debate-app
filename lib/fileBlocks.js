// アップロードされたファイルを、テキスト抽出せずにそのまま Claude API の content block に変換する。
// PDF は document block（base64）として、テキストファイルはそのままテキストとして渡す。
export function buildContentBlocks(files) {
  return files.map((file) => {
    const isPdf = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: file.buffer.toString("base64"),
        },
        title: file.originalname,
      };
    }
    return {
      type: "text",
      text: `【${file.originalname}】\n${file.buffer.toString("utf-8")}`,
    };
  });
}

export function fileNames(files) {
  return files.map((f) => f.originalname);
}
