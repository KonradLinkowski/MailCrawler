const fs = require('fs')
const axios = require('axios')

class Crawler {
  constructor() {
    this.mailRegex = /[a-z0-9._+-]+(@|\[at\])[a-z0-9._+-]+\.[a-z0-9._+-]+/gi
    this.linkRegex = /https?:\/\/(www\.)?[a-z0-9._+-]+\.[a-z0-9._+-]+/gi
    this.visitedLinks = []
    this.visitedMails = []
    this.data = ''
  }
  async search(link) {
    this.data = (await axios.get(link)).data
  }
  retrieveLinks() {
    const retrieved = [... new Set(this.data.match(this.linkRegex))].filter(e => !this.visitedLinks.includes(e))
    Array.prototype.push.apply(this.visitedLinks, retrieved)
    return retrieved
  }
  retrieveMails() {
    const retrieved = [... new Set(this.data.match(this.mailRegex))].filter(e => !this.visitedMails.includes(e))
    Array.prototype.push.apply(this.visitedMails, retrieved)
    return retrieved
  }
}

const save = (url, links, mails) => {
  console.log('url:', url)
  console.log('links', links)
  if (links && links.length) {
    fs.appendFile('links.txt',
    '\n  '
    + url
    + ':\n'
    + links.join('\n')
    + '\n'
    , () => {})
  }
  console.log('mails', mails)
  if (mails && mails.length) {
    fs.appendFile('mails.txt',
    '\n  '
    + url
    + ':\n'
    + mails.join('\n')
    + '\n'
    , () => {})
  }
}

const start = async (link) => {
  const crawler = new Crawler()
  const linkQueue = [link]
  while (true) {
    const url = linkQueue.shift()
    if (!url) {
      break
    }
    try {
      await crawler.search(url)
      const links = crawler.retrieveLinks()
      const mails = crawler.retrieveMails()
      save(url, links, mails)
      if (links) {
        Array.prototype.push.apply(linkQueue, links)
      }
    } catch (error) {
      console.error(error.message)
    }
  }
}

const startLink = process.argv[2]
start(startLink)
