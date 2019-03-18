const mongoose = require('mongoose')

const MailSchema = new mongoose.Schema({
  mail: {
    type: String,
    unique: true,
    required: true
  }
})

const Mail = mongoose.model('mail', MailSchema, 'mails')

module.exports = Mail
