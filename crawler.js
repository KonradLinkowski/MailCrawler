const fs = require('fs')
const axios = require('axios')

class Crawler {
  constructor() {
    this.mailRegex = /[a-z0-9._+-]+(@|\[at\])[a-z0-9_+-]+(\.[a-z0-9_+-]+)+/gi
    this.linkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi
    this.hostRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}/gi
    this.noPageRegex = /\.(jpg|png|gif|mp4|mp3|wav|css|js|webm|ogg|ico)$/gi
    this.visitedLinks = []
    this.visitedMails = []
    this.data = ''
    this.index = 0
  }
  async search(link) {
    const response = await axios.get(link, { transformResponse: res => res })
    this.data = response.data
    this.index += 1
  }
  retrieveLinks() {
    const retrieved = [... new Set(this.data.match(this.linkRegex))].filter(e => !e.match(this.noPageRegex) && !this.visitedLinks.includes(e))
    const hosts = [... new Set(retrieved.map(e => e.match(this.hostRegex)))]
    Array.prototype.push.apply(this.visitedLinks, retrieved)
    Array.prototype.push.apply(this.visitedMails, hosts)
    return retrieved
  }
  retrieveMails() {
    const retrieved = [... new Set(this.data.match(this.mailRegex))].filter(e => !e.match(this.noPageRegex) && !this.visitedMails.includes(e))
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
    + '\n'
    + links.join('\n')
    + '\n'
    , () => {})
  }
  console.log('mails', mails)
  if (mails && mails.length) {
    fs.appendFile('mails.txt',
    '\n  '
    + url
    + '\n'
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
      console.log('index:', crawler.index)
      console.log(url)
      save(url, links, mails)
      if (links) {
        Array.prototype.push.apply(linkQueue, links)
      }
    } catch (error) {
      console.log(url)
      console.error(error.message)
    }
  }
}

const startLink = process.argv[2]
start(startLink)
