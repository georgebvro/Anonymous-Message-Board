'use strict';

const mongoose = require('mongoose');
mongoose.connect(process.env.DB);

const threadSchema = new mongoose.Schema({
  board: { type: String, required: true },
  text: { type: String, required: true },
  created_on: { type: Date, required: true },
  bumped_on: { type: Date, required: true },
  reported: { type: Boolean, default: false },
  delete_password: { type: String, required: true },
  replies: Array
});

const Thread = mongoose.model('Thread', threadSchema);

module.exports = function (app) {
  
  app.route('/api/threads/:board')
    
    .post(async (req, res) => {
      const date = new Date();
      try {
        const thread = await Thread.create({
          _id: req.body._id || new mongoose.Types.ObjectId(),
          board: req.params.board,
          text: req.body.text,
          created_on: req.body.created_on || date,
          bumped_on: req.body.bumped_on || date,
          delete_password: req.body.delete_password,
          replies: []
        });
        res.redirect('/b/' + req.params.board + '/');
      }
      catch (err) {
        console.error('Error creating thread document:', err);
        throw err;
      }
    })

    .get(async (req, res) => {
      try{
        const threads = await Thread.find({ board: req.params.board }).sort('-bumped_on').limit(10).lean();
        const processedThreads = threads.map(thread => {
          //deconstructing thread object
          let {_id, board, text, created_on, bumped_on, replies} = thread;
          //only keep the last 3 replies and only keep _id, text and created_on properties in each reply,
          //using deconstructing of the reply object directly in the parameter list of the arrow function;
          //in this case, the paranthesis around parameter and returned objects are necessary
          replies = replies.slice(-3).map(({ _id, text, created_on }) => ({ _id, text, created_on }));
          //returning the reconstructed object
          return {_id, board, text, created_on, bumped_on, replies, replycount: thread.replies.length};
        });
        res.json(processedThreads);
      }
      catch (err) {
        console.error('Error finding thread documents:', err);
        throw err;
      }
    })

    .delete(async (req, res) => {
      try {
        const deletedThread = await Thread.findOneAndDelete({ _id: req.body.thread_id, delete_password: req.body.delete_password });
        if (deletedThread) {
          res.send('success');
        } else {
          res.send('incorrect password');
        };
      }
      catch (err) {
        console.error('Error deleting thread document:', err);
        throw err;
      }
    })

    .put(async (req, res) => {
      try{
        const thread = await Thread.findByIdAndUpdate(req.body.thread_id, { reported: true });
        if (thread) res.send('reported');
      }
      catch (err) {
        console.error('Error setting report status on thread document:', err);
        throw err;
      }
    });

  app.route('/api/replies/:board')

    .post(async (req, res) => {
      const date = new Date();
      try {
        const thread = await Thread.findById(req.body.thread_id);
        thread.bumped_on = req.body.created_on || date;
        thread.replies.push({
          _id: req.body._id || new mongoose.Types.ObjectId(),
          text: req.body.text,
          created_on: req.body.created_on || date,
          delete_password: req.body.delete_password,
          reported: false
        });
        await thread.save();
        res.redirect('/b/' + req.params.board + '/' + thread._id);
      }
      catch (err) {
        console.error('Error saving reply to thread document:', err);
        throw err;
      }
    })

    .get(async (req, res) => {
      try{
        const thread = await Thread.findById(req.query.thread_id).lean();
        delete thread.delete_password;
        delete thread.reported;
        thread.replies.map(reply => {
          delete reply.delete_password;
          delete reply.reported;
          return reply;
        });
        res.json(thread);
      }
      catch (err) {
        console.error('Error finding thread document:', err);
        throw err;
      }
    })

    .delete(async (req, res) => {
      try{
        let result;
        const thread = await Thread.findById(req.body.thread_id);
        const processedReplies = thread.replies.map(reply => {
          if (reply._id == req.body.reply_id) {
            if (reply.delete_password == req.body.delete_password) {
              reply.text = '[deleted]';
              result = 'success';
            } else {
              result = 'incorrect password';
            }
          }
          return reply;
        });
        thread.replies = processedReplies;
        thread.markModified('replies');
        await thread.save();
        if (result) {
          res.send(result);
        };
      }
      catch (err) {
        console.error('Error deleting reply from thread document:', err);
        throw err;
      }
    })

    .put(async (req, res) => {
      try {
        let result;
        const thread = await Thread.findById(req.body.thread_id);
        thread.replies = thread.replies.map(reply => {
          if (reply._id == req.body.reply_id) {
            reply.reported = true;
            result = 'reported';
          }
          return reply;
        })
        thread.markModified('replies');
        await thread.save();
        if (result) res.send(result);
      }
      catch (err) {
        console.error('Error setting report status on reply object:', err);
      }
    });

};

module.exports.Thread = Thread;