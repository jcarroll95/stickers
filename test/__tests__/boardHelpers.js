const request = require('supertest');
const app = require('../../server');

/**
 * Creates a stickerboard for testing purposes.
 * @param {Object} params
 * @param {string} params.token - JWT token for authentication
 * @param {string} params.name - Name of the board
 * @param {string} params.description - Description of the board
 * @returns {Promise<{boardId: string, board: Object}>}
 */
const createBoard = async ({ token, name, description, ...rest }) => {
  const res = await request(app)
    .post('/api/v1/stickerboards')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name,
      description,
      backgroundFile: 'sb0',
      width: 1000,
      height: 700,
      tags: [],
      ...rest
    })
    .expect(201);

  return {
    boardId: res.body.data._id,
    board: res.body.data
  };
};

module.exports = {
  createBoard
};
