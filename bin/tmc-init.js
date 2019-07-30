#!/usr/bin/env node

const program = require('commander')
const path = require('path')
const fs = require('fs')
const glob = require('glob')
const download = require('../lib/download')
const inquirer = require('inquirer')
const chalk = require('chalk')
const logSymbols = require('log-symbols')
const generator = require('../lib/generator')

program.usage('<project-name>').parse(process.argv)

// 获取新建项目名称
let projectName = program.args[0]

if (!projectName) { // project-name 必填
  // 相当于执行命令的--help选项，显示help信息，这是commander内置的一个命令选项
  program.help()
  return
}

const rootName = path.basename(process.cwd()) // 获取当前路径
const list = glob.sync('*') // 遍历当前目录

let next = undefined

const inquirerList = [{
  name: 'projectVersion',
  message: '项目的版本',
  type: 'input',
  default: '0.1.0',
}, {
  name: 'projectDescription',
  message: '项目的描述',
  type: 'input',
  default: 'test',
}, {
  name: 'author',
  message: '项目的作者',
  type: 'input',
  default: 'kuntang',
}]

if (list.length) { // 如果当前目录不为空
  if (list.filter(name => {
      const fileName = path.resolve(process.cwd(), path.join('.', name))
      const isDir = fs.statSync(fileName).isDirectory()
      return name.indexOf(projectName) !== -1 && isDir
    }).length !== 0) {
    console.log(`项目${projectName}已经存在`)
    return
  }
  next = inquirer.prompt(inquirerList).then(answer => {
    return Promise.resolve({
      projectPath: projectName,
      ...answer
    })
  })
} else if (rootName === projectName) {
  next = inquirer.prompt([{
    name: 'projectPath',
    message: '当前目录为空，且目录名称和项目名称相同，是否直接在当前目录下创建新项目？',
    type: 'confirm',
    default: true
  }, ...inquirerList]).then(answer => {
    return Promise.resolve({
      projectPath: answer.buildInCurrent ? '.' : projectName,
      ...answer
    })
  })
} else {
  next = inquirer.prompt(inquirerList).then(answer => {
    return Promise.resolve({
      projectPath: projectName,
      ...answer
    })
  })
}

next && initialization()

function initialization() {
  next.then(answer => {
    const {
      projectPath,
      projectVersion,
      projectDescription,
      author,
    } = answer
    if (projectPath !== '.') {
      fs.mkdirSync(projectPath)
    }
    return download(projectPath).then(downloadTempPath => {
      return {
        projectName,
        projectVersion,
        projectDescription,
        projectPath,
        author,
        downloadTemp: downloadTempPath,
      }
    })
  }).then(context => {
    const src = path.join(process.cwd(), context.downloadTemp)
    const dest = path.join(process.cwd(), context.projectPath)
    return generator(context, src, dest)
  }).then(context => {
    // 成功用绿色显示，给出积极的反馈
    console.log(logSymbols.success, chalk.green('创建成功:)'))
    console.log()
    console.log(chalk.green('cd ' + context.root + '\nnpm install\nnpm run dev'))
  }).catch(error => {
    // 失败了用红色，增强提示
    console.error(logSymbols.error, chalk.red(`创建失败：${error.message}`))
  })
}