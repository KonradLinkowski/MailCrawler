require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const mongoose = require('mongoose')
const Link = require('./schemas/link')
const Mail = require('./schemas/mail')

class Crawler {
  constructor() {
    this.mailRegex = /[a-z0-9._+-]+(@|\[at\])[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}/gi
    this.linkRegex = 
    
    this.hostRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}/gi
    this.noPageRegex = /\.(jpeg|jpg|png|gif|mp4|mp3|wav|css|js|webm|ogg|ico|sv|gz|zip|exe|jar|pdf|ttf)$/gi
    this.visitedLinks = []
    this.visitedMails = []
    this.data = ''
    this.index = 0
  }
  async search(link) {
    const response = await axios.get(link, { timeout: 5000, transformResponse: res => res })
    this.data = response.data
    this.index += 1
  }
  async retrieveLinks() {
    const retrieved = [... new Set(this.data.match(this.linkRegex))].filter(l => !l.match(this.noPageRegex))
    const hosts = [... new Set(retrieved.map(e => e.match(this.hostRegex)))]
    Array.prototype.push.apply(this.visitedLinks, retrieved)
    Array.prototype.push.apply(this.visitedMails, hosts)
    const final = (await Promise.all(retrieved.map(async url => {
      const found = await Link.findOne({ url })
      return found ? null : url
    }))).filter(e => e)
    return final
  }
  async retrieveMails() {
    const retrieved = [... new Set(this.data.match(this.mailRegex))].filter(l => !l.match(this.noPageRegex))
    Array.prototype.push.apply(this.visitedLinks, retrieved)
    const final = (await Promise.all(retrieved.map(async mail => {
      const found = await Mail.findOne({ mail })
      return found ? null : mail
    }))).filter(e => e)
    return final
  }
}

const save = async (url, links, mails) => {
  console.log('url:', url)
  console.log('links', links)
  if (links && links.length) {
    await Link.insertMany(links.map(url => { return { url } }))
  }
  console.log('mails', mails)
  if (mails && mails.length) {
    await Mail.insertMany(mails.map(mail => { return { mail } }))
  }
}

const start = async (link) => {
  const crawler = new Crawler()
  const linkQueue = [link]
  while (true) {
    let url = linkQueue.shift()
    if (!url) {
      const count = await Link.collection.countDocuments()
      url = (await Link.findOne().skip(Math.floor(Math.random() * count))).url
    }
    console.log('next:', url)
    try {
      await crawler.search(url)
      console.log('searched')
      const links = await crawler.retrieveLinks()
      const mails = await crawler.retrieveMails()
      console.log('index:', crawler.index)
      console.log(url)
      await save(url, links, mails)
      if (links) {
        Array.prototype.push.apply(linkQueue, links)
      }
    } catch (error) {
      console.log(url)
      console.error(error.message)
      if (['ENOTFOUND'].includes(error.code) || (error.response && error.response.status >= 400)) {
        console.log('deleting:', url)
        await Link.deleteOne({ url })
      }
    }
  }
}

mongoose.connect(process.env.MONGO_STRING, { useNewUrlParser: true, useCreateIndex: true })
.then(res => {
  const startLink = process.argv[2]
  start(startLink)
})
.catch(err => {
  console.error(err)
})
