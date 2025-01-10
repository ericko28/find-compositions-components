const fs = require('fs')
const path = require('path')
const readline = require('readline')

const prompt = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
      rl.close()
    })
  })
}

const getFileInfo = (filepath) => {
  const name = path.parse(filepath).name
  const ext = path.parse(filepath).ext
  return { filepath, name, ext }
}

function* readAllFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* readAllFiles(path.join(dir, file.name))
    } else {
      const filePath = path.join(dir, file.name)
      const fileInfo = getFileInfo(filePath)
      yield fileInfo
    }
  }
}

function bufferFile(relPath) {
  return fs.readFileSync(path.join(__dirname, relPath))
}

const getVueFiles = (dir) => {
  const files = []
  for (const file of readAllFiles(dir)) {
    if (!file.filepath.includes('node_modules')) {
      if (file.ext === '.vue') {
        const content = bufferFile(file.filepath, {
          encoding: 'utf8',
        }).toString()
        files.push({ content, ...file })
      }
    }
  }
  return files
}

const validateCompositionAPI = (content) => {
  const compositionAPIRegex = /<script[^>]*\bsetup\b[^>]*/
  return compositionAPIRegex.test(content)
}

const getCompositionAPIComponents = (dir) => {
  return getVueFiles(dir).map((file) => {
    const isComposition = validateCompositionAPI(file.content)
    const content = `<tr><td>${file.filepath}</td><td style="color: ${!isComposition ? 'red' : 'green'}">${
      isComposition ? 'Composition API' : 'Options API'
    }</td></tr>`

    return { content, isComposition }
  })
}

const createReport = async () => {
  const dir =
    (await prompt('Enter the directory path (current by default): ')) || '.'
  const components = getCompositionAPIComponents(dir)
  const stream = fs.createWriteStream('output.html')
  stream.once('open', () => {
    stream.write(`<!DOCTYPE html>
        <html>
          <head>
            <title>Page Title</title>
          </head>
          <body>\n`)

    const total = components.length
    const compositionAPI = components.filter(
      ({ isComposition }) => isComposition,
    )
    const optionsAPI = components.filter(({ isComposition }) => !isComposition)
    stream.write(`<h1>Total components: ${total}</h1>\n`)
    stream.write(`<h3>Composition API: ${compositionAPI.length}</h3>\n`)
    stream.write(`<h3>Options API: ${optionsAPI.length}</h3>\n`)
    stream.write(`
            <table border="1">\n`)
    components.forEach(({ content }) => {
      stream.write(`${content}\n`)
    })
    stream.write(`</table></body>
</html>`)
    stream.end()
  })
}

createReport()
