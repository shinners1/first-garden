const { getGraph } = require("../../helpers/linkUtils");
const { getFileTree } = require("../../helpers/filetreeUtils");
const { userComputed } = require("../../helpers/userUtils");

module.exports = {
  // Eleventy가 getGraph의 Promise를 await 하도록 async/await로 감싸줍니다.
  graph: async (data) => {
    return await getGraph(data);
  },

  // getFileTree와 userComputed는 동기 또는 내부에서 자체적으로 Promise를 처리한다면 그대로 두어도 됩니다.
  filetree: (data) => getFileTree(data),
  userComputed: (data) => userComputed(data),
};
