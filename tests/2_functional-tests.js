const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');
const mongoose = require('mongoose');

chai.use(chaiHttp);

const { Thread } = require('../routes/api.js');

suite('Functional Tests:', function() {

  const createThreads = async (text, threadsNumber) => {
    const threadsDetails = [];
    for (let i = 0; i < threadsNumber; i ++) {
      const _id = new mongoose.Types.ObjectId();
      const date = new Date();
      const textWithCounter = text + ' (' + i + ')';
      const res = await chai.request(server)
      .post('/api/threads/tests')
      .set('Content-Type', 'application/json')
      .send({
        _id,
        text: textWithCounter,
        created_on: date,
        bumped_on: date,
        delete_password: 'password' 
      });
      threadsDetails.push({ _id, date, res });
    };
    return threadsDetails;
  };

  const createReplies = async (thread_id, text, repliesNumber) => {
    const replyDetails = [];
    for (let i = 0; i < repliesNumber; i ++) {
      const _id = new mongoose.Types.ObjectId();
      const date = new Date();
      const textWithCounter = text + ' (' + i + ')';
      const res = await chai.request(server)
      .post('/api/replies/tests')
      .set('Content-Type', 'application/json')
      .send({
        thread_id,
        _id,
        text: textWithCounter,
        created_on: date,
        delete_password: 'password'
      });
      replyDetails.push({ _id, date, res });
    };
    return replyDetails;
  }

  test('Creating a new thread: POST request to /api/threads/{board}', async () => {
    try {
      const threadDetails = await createThreads('Test for creating a new thread', 1);
      assert.equal(threadDetails[0].res.ok, true, 'Failure creating a new thread (unsuccessful request).');
      return await Thread.findById(threadDetails[0]._id)
      .then(({ board, text, created_on, bumped_on, reported, delete_password, replies }) => {
        assert.equal(board, 'tests', 'Failure creating a new thread (wrong "board" value).');
        assert.equal(text, 'Test for creating a new thread (0)', 'Failure creating a new thread (wrong "text" value).');
        assert.deepEqual(created_on, threadDetails[0].date, 'Failure creating a new thread (wrong "created_on" value).');
        assert.deepEqual(bumped_on, threadDetails[0].date, 'Failure creating a new thread (wrong "bumped_on" value).');
        assert.equal(reported, false, 'Failure creating a new thread (wrong "reported" value).');
        assert.equal(delete_password, 'password', 'Failure creating a new thread (wrong "delete_password" value).');
        assert.isEmpty(replies, 'Failure creating a new thread (replies is not empty array).');
      });
    }
    catch (err) {
      console.error('Error testing creating a new thread:', err);
      throw err;
    }
  });

  test('Viewing the 10 most recent threads with 3 replies each: GET request to /api/threads/{board}', async () => {
    try{      
      let threadsDetails = await createThreads('Thread created for viewing the 10 most recent threads with 3 replies each', 11);
      const lastThreadDetails = threadsDetails[threadsDetails.length - 1];
      const replyDetails = await createReplies(lastThreadDetails._id, 'Test reply created for viewing the 10 most recent threads with 3 replies each', 4);
      const reply_ids = replyDetails.slice(-3).map(reply => reply._id.toHexString());
      const thread_ids = threadsDetails.slice(-10).sort((a, b) => b.date - a.date).map(thread => thread._id.toHexString());
      const res = await chai.request(server).get('/api/threads/tests/');
      const resThread_ids = res.body.map(thread => thread._id);
      const resReply_ids = res.body[0].replies.map(reply => reply._id);
      assert.lengthOf(res.body, 10, 'Failure viewing the 10 most recent threads with 3 replies each (not 10 threads returned).');
      assert.deepEqual(thread_ids, resThread_ids, 'Failure viewing the 10 most recent threads with 3 replies each (wrong threads returned).');
      assert.lengthOf(res.body[0].replies, 3, 'Failure viewing the 10 most recent threads with 3 replies each (not max 3 replies per thread).');
      assert.deepEqual(reply_ids, resReply_ids, 'Failure viewing the 10 most recent threads with 3 replies each (wrong replies returned).');
    }
    catch (err) {
      console.error('Error testing viewing the 10 most recent threads with 3 replies each:', err);
      throw err;
    }
  });

  test('Deleting a thread with the incorrect password: DELETE request to /api/threads/{board} with an invalid delete_password', async () => {
    try{
      const threadDetails = await createThreads('Test thread created only to be deleted later', 1);
      const delRes = await chai.request(server)
      .del('/api/threads/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id,
        delete_password: 'incorrect password'
      });
      assert.equal(delRes.ok, true, 'Failure deleting a thread with the incorrect password (unsuccessful request).');
      assert.equal(delRes.text, 'incorrect password', 'Failure deleting a thread with the incorrect password (incorrect text response).');
      const findRes = await Thread.findById(threadDetails[0]._id);
      assert.isNotNull(findRes, 'Failure deleting a thread with the incorrect password (thread was deleted).');
    }
    catch (err) {
      console.error('Error testing deleting a thread with the incorrect password:', err);
      throw err;
    }
    
  });

  test('Deleting a thread with the correct password: DELETE request to /api/threads/{board} with a valid delete_password', async () => {
    try{
      const threadDetails = await createThreads('Test thread created only to be deleted later', 1);
      const delRes = await chai.request(server)
      .del('/api/threads/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id,
        delete_password: 'password'
      });
      assert.equal(delRes.ok, true, 'Failure deleting a thread with the correct password (unsuccessful request).');
      assert.equal(delRes.text, 'success', 'Failure deleting a thread with the correct password (incorrect text response).');
      const findRes = await Thread.findById(threadDetails[0]._id);
      assert.isNull(findRes, 'Failure deleting a thread with the correct password (thread was not deleted).');
    }
    catch (err) {
      console.error('Error testing deleting a thread with the correct password:', err);
      throw err;
    }
  });

  test('Reporting a thread: PUT request to /api/threads/{board}', async () => {
    try {
      const threadDetails = await createThreads('Test thread created for reporting later', 1);
      const putRes = await chai.request(server)
      .put('/api/threads/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id
      });
      assert.equal(putRes.ok, true, 'Failure reporting a thread (unsuccessful request).');
      assert.equal(putRes.text, 'reported', 'Failure reporting a thread (incorrect text response).');
      const findRes = await Thread.findById(threadDetails[0]._id);
      assert.equal(findRes.reported, true, 'Failure reporting a thread (incorrect "reported" value).');
    }
    catch (err) {
      console.error('Error testing reporting a thread:', err);
      throw err;
    }
  });

  test('Creating a new reply: POST request to /api/replies/{board}', async () => {
    try {
      const threadDetails = await createThreads('Thread created for creating a new reply', 1);
      const replyDetails = await createReplies(threadDetails[0]._id, 'Test for creating a new reply', 1);
      assert.equal(replyDetails[0].res.ok, true, 'Failure creating a new reply (unsuccessful request).');
      const foundThread = await Thread.findById(threadDetails[0]._id);
      assert.deepEqual(foundThread.bumped_on, replyDetails[0].date);
      assert.equal(foundThread.replies[0].text, 'Test for creating a new reply (0)', 'Failure creating a new reply (wrong "text" value).');
      assert.deepEqual(new Date(foundThread.replies[0].created_on), replyDetails[0].date, 'Failure creating a new reply (wrong "created_on" value).');
      assert.equal(foundThread.replies[0].delete_password, 'password', 'Failure creating a new reply (wrong "delete_password" value).');
      assert.equal(foundThread.replies[0].reported, false, 'Failure creating a new reply (wrong "reported" value).');
    }
    catch (err) {
      console.error('Error testing creating a new reply:', err);
      throw err;
    }
  })

  test('Viewing a single thread with all replies: GET request to /api/replies/{board}', async () => {
    try{      
      const threadDetails = await createThreads('Thread created for viewing a single thread with all replies', 1);
      const replyDetails = await createReplies(threadDetails[0]._id, 'Test reply created for viewing a single thread with all replies', 4);
      const reply_ids = replyDetails.map(reply => reply._id.toHexString());
      const res = await chai.request(server).get('/api/replies/tests/?thread_id=' + threadDetails[0]._id);
      const resReply_ids = res.body.replies.map(reply => reply._id);
      assert.deepEqual(threadDetails[0]._id.toHexString(), res.body._id, 'Failure viewing a single thread with all replies (wrong thread returned).');
      assert.lengthOf(res.body.replies, 4, 'Failure viewing a single thread with all replies (wrong number of replies returned).');
      assert.deepEqual(reply_ids, resReply_ids, 'Failure viewing a single thread with all replies (wrong replies returned).');
    }
    catch (err) {
      console.error('Error testing viewing the 10 most recent threads with 3 replies each:', err);
      throw err;
    }
  });

  test('Deleting a reply with the incorrect password: DELETE request to /api/replies/{board} with an invalid delete_password', async () => {
    try {
      const threadDetails = await createThreads('Thread created for deleting a reply with the incorrect password', 1);
      const replyDetails = await createReplies(threadDetails[0]._id, 'Test reply created for deleting a reply with the incorrect password', 1);
      const res = await chai.request(server)
      .del('/api/replies/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id,
        reply_id: replyDetails[0]._id,
        delete_password: 'incorrect password'
      });
      assert.equal(res.ok, true, 'Failure deleting a reply with the incorrect password (unsuccessful request).');
      assert.equal(res.text, 'incorrect password', 'Failure deleting a reply with the incorrect password (incorrect text response).');  
    }
    catch (err) {
      console.error('Error testing deleting a reply with the incorrect password:', err);
      throw err;
    }
  });

  test('Deleting a reply with the correct password: DELETE request to /api/replies/{board} with a valid delete_password', async () => {
    try {
      const threadDetails = await createThreads('Thread created for deleting a reply with the correct password', 1);
      const replyDetails = await createReplies(threadDetails[0]._id, 'Test reply created for deleting a reply with the correct password', 1);
      const res = await chai.request(server)
      .del('/api/replies/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id,
        reply_id: replyDetails[0]._id,
        delete_password: 'password'
      });
      assert.equal(res.ok, true, 'Failure deleting a reply with the correct password (unsuccessful request).');
      assert.equal(res.text, 'success', 'Failure deleting a reply with the correct password (incorrect text response).');
      const foundThread = await Thread.findById(threadDetails[0]._id);
      assert.equal(foundThread.replies[0].text, '[deleted]', 'Failure deleting a reply with the correct password (incorrect "text" value)');  
    }
    catch (err) {
      console.error('Error testing deleting a reply with the correct password:', err);
      throw err;
    }    
  });

  test('Reporting a reply: PUT request to /api/replies/{board}', async () => {
    try {
      const threadDetails = await createThreads('Thread created for reporting a reply', 1);
      const replyDetails = await createReplies(threadDetails[0]._id, 'Test reply created for reporting a reply', 1);
      const res = await chai.request(server)
      .put('/api/replies/tests/')
      .set('Content-Type', 'application/json')
      .send({
        thread_id: threadDetails[0]._id,
        reply_id: replyDetails[0]._id
      });
      assert.equal(res.ok, true, 'Failure reporting a reply (unsuccessful request).');
      assert.equal(res.text, 'reported', 'Failure reporting a reply (incorrect text response).');
      const foundThread = await Thread.findById(threadDetails[0]._id);
      assert.equal(foundThread.replies[0].reported, true, 'Failure reporting a reply (incorrect "reported" value)');  
    }
    catch (err) {
      console.error('Error testing reporting a reply:', err);
      throw err;
    }
  });

});
