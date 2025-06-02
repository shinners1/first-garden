const wikiLinkRegex = /\[\[(.*?\|.*?)\]\]/g;
const internalLinkRegex = /href="\/(.*?)"/g;

function caselessCompare(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function extractLinks(content) {
  return [
    ...(content.match(wikiLinkRegex) || []).map((link) =>
      link
        .slice(2, -2)
        .split("|")[0]
        .replace(/.(md|markdown)\s?$/i, "")
        .replace("\\", "")
        .trim()
        .split("#")[0]
    ),
    ...(content.match(internalLinkRegex) || []).map((link) =>
      link
        .slice(6, -1)
        .split("|")[0]
        .replace(/.(md|markdown)\s?$/i, "")
        .replace("\\", "")
        .trim()
        .split("#")[0]
    ),
  ];
}

/**
 * Eleventy v3에서는 `v.template.frontMatter`에 동기적으로 접근할 수 없으므로
 * 반드시 `await v.template.read()`를 사용해야 합니다. (Eleventy 내부 문서 참고) :contentReference[oaicite:3]{index=3}
 */
async function getGraph(data) {
  const nodes = {};
  const links = [];
  const stemURLs = {};
  let homeAlias = "/";

  // `data.collections.note`가 배열 형태로 넘어온다고 가정
  const notes = data.collections.note || [];

  // for (let idx in notes) 패턴 대신, 인덱스를 직접 관리하는 for문 사용
  for (let idx = 0; idx < notes.length; idx++) {
    const v = notes[idx];
    // 파일 경로에서 '/notes/' 부분 제거 후 상대경로 추출
    const fpath = v.filePathStem.replace("/notes/", "");
    const parts = fpath.split("/");
    let group = "none";
    if (parts.length >= 3) {
      group = parts[parts.length - 2];
    }

    // Eleventy v3에서 템플릿 본문(content)을 비동기적으로 읽어옵니다.
    // `template.read()`는 { data, content } 형태를 반환하며, content에 본문 내용이 담깁니다. :contentReference[oaicite:4]{index=4}
    const { content } = await v.template.read();
    const outLinksRaw = extractLinks(content);

    nodes[v.url] = {
      id: idx,
      title: v.data.title || v.fileSlug,
      url: v.url,
      group,
      home:
        v.data["dg-home"] ||
        (v.data.tags && v.data.tags.indexOf("gardenEntry") > -1) ||
        false,
      // 이전: extractLinks(v.template.frontMatter.content)
      // 변경: await v.template.read()로 읽어온 content 사용
      outBound: outLinksRaw,
      neighbors: new Set(),
      backLinks: new Set(),
      noteIcon: v.data.noteIcon || process.env.NOTE_ICON_DEFAULT,
      hide: v.data.hideInGraph || false,
    };

    // fpath → URL 매핑 저장
    stemURLs[fpath] = v.url;

    // homeAlias 설정: dg-home 플래그 또는 gardenEntry 태그가 있으면 홈으로 간주
    if (
      v.data["dg-home"] ||
      (v.data.tags && v.data.tags.indexOf("gardenEntry") > -1)
    ) {
      homeAlias = v.url;
    }
  }

  // 이제 노드 간 연결(links)과 이웃(neighbors), 백링크(backLinks) 계산
  for (const node of Object.values(nodes)) {
    const outBoundSet = new Set();

    // 중복 제거: 원본 outBound 배열에서 stemURLs 맵핑을 통해 실제 URL로 변환
    node.outBound.forEach((olink) => {
      const link = (stemURLs[olink] || olink).split("#")[0];
      outBoundSet.add(link);
    });

    node.outBound = Array.from(outBoundSet);

    node.outBound.forEach((link) => {
      const n = nodes[link];
      if (n) {
        n.neighbors.add(node.url);
        n.backLinks.add(node.url);
        node.neighbors.add(n.url);
        links.push({ source: node.id, target: n.id });
      }
    });
  }

  // final 정리: Set → Array, size 계산
  Object.keys(nodes).forEach((k) => {
    nodes[k].neighbors = Array.from(nodes[k].neighbors);
    nodes[k].backLinks = Array.from(nodes[k].backLinks);
    nodes[k].size = nodes[k].neighbors.length;
  });

  return {
    homeAlias,
    nodes,
    links,
  };
}

exports.wikiLinkRegex = wikiLinkRegex;
exports.internalLinkRegex = internalLinkRegex;
exports.extractLinks = extractLinks;
// async 함수이므로 호출하는 쪽(eleventyComputed 등)도 await/Promise를 처리해야 합니다.
exports.getGraph = getGraph;
