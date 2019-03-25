require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const mongoose = require('mongoose')
const URL = require('url').URL
const jsdom = require('jsdom').JSDOM
const Link = require('./schemas/link')
const Mail = require('./schemas/mail')

class Crawler {
  constructor() {
    this.mailRegex = /[a-z0-9._+-]+(@|\[at\])[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}/gi
    this.linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi
    
    this.hostRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}/gi
    this.noPageRegex = /\.(jpeg|jpg|png|gif|mp4|mp3|wav|css|js|webm|ogg|ico|sv|gz|zip|exe|jar|pdf|ttf)$/gi
    this.response = null
    this.data = ''
    this.url = ''
    this.index = 0
  }
  async search(link) {
    this.url = link
    this.response = await axios.get(link, { timeout: 5000, transformResponse: res => res })
    this.data = this.response.data
    this.index += 1
  }
  async retrieveLinks() {
    let links = []
    if (this.response.headers['content-type'].includes('html')) {
        const anchors = [... new jsdom(this.data).window.document.querySelectorAll('a')].map(e => new URL(e, this.url)).filter(e => e.host.length)
        const retrieved = [... new Set(anchors.map(e => e.href))].filter(l => !l.match(this.noPageRegex))
        const hosts = [... new Set(retrieved.map(e => e.origin))]
        links = retrieved.concat(hosts)
    } else {
      const retrieved = [... new Set(this.data.match(this.linkRegex))].filter(l => !l.match(this.noPageRegex))
      const hosts = [... new Set(retrieved.map(e => e.match(this.hostRegex)))]
      links = retrieved.concat(hosts)
    }
    const final = (await Promise.all(links.map(async url => {
      const found = await Link.findOne({ url })
      return found ? null : url
    }))).filter(e => e).filter(link => Buffer.from(link).length <= 1024)
    return final
  }
  async retrieveMails() {
    const retrieved = [... new Set(this.data.match(this.mailRegex))].filter(l => !l.match(this.noPageRegex))
    const final = (await Promise.all(retrieved.map(async mail => {
      const found = await Mail.findOne({ mail })
      return found ? null : mail
    }))).filter(e => e)
    return final
  }
}

const save = async (url, links, mails) => {
  console.log('url:', url)
  try {
    if (links && links.length) {
      console.log('links', links)
      await Link.insertMany(links.map(url => { return { url, processed: 'no' } }), { ordered: false })
    }
  } catch (error) {
    console.error(error.message)
  }
  try {
    console.log('mails', mails)
    if (mails && mails.length) {
      await Mail.insertMany(mails.map(mail => { return { mail } }), { ordered: false })
    }
  } catch (error) {
    console.error(error.message)
  }
  await Link.update({ url }, { processed: 'yes' } )
}

const start = async (link) => {
  const crawler = new Crawler()
  const linkQueue = [link]
  while (true) {
    let url = linkQueue.shift()
    if (!url) {
      const links = await Link.find({ processed: 'no' }).limit(100)
      Array.prototype.push.apply(linkQueue, links.map(obj => obj.url))
      url = linkQueue.shift()
    }
    console.log('next:', url)
    try {
      await crawler.search(url)
      console.log('searched')
      const links = await crawler.retrieveLinks()
      const mails = await crawler.retrieveMails()
      console.log('index:', crawler.index)
      await save(url, links, mails)
    } catch (error) {
      console.log(url)
      console.error(error.message)
      if (error.response && error.response.status === 429) {
        linkQueue.length = 0
      } else if (['ENOTFOUND'].includes(error.code) || (error.response && error.response.status >= 400)) {
        await Link.update({ url }, { processed: 'unavailable' })
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
