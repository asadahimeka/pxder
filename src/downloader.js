require('colors');
const Illust = require('./illust');
const Fse = require('fs-extra');
const Path = require('path');
const Tools = require('./tools');
const { UgoiraDir } = Tools;

const pixivRefer = 'https://www.pixiv.net/';

let config;
let httpsAgent = false;

function setConfig(conf) {
	config = conf;
}

function setAgent(agent) {
	httpsAgent = agent;
}

/**
 * 下载画师们的画作
 *
 * @param {Array<Illustrator>} illustrators 画师数组
 * @param {Function} callback 每成功下载完一个画师时运行的回调
 */
async function downloadByIllustrators(illustrators, callback) {
	for (const i in illustrators) {
		const illustrator = illustrators[i];

		const error = await illustrator.info().catch(e => e);
		if (error && error.status && error.status == 404) {
			console.log('\nIllustrator ' + 'uid '.gray + illustrator.id.toString().cyan + ' may have left pixiv or does not exist.');
			continue;
		}

		console.log('\nCollecting illusts of ' + (parseInt(i) + 1).toString().green + '/' + illustrators.length + ' uid '.gray + illustrator.id.toString().cyan + ' ' + illustrator.name.yellow);

		// 取得下载信息
		const info = await getDownloadListByIllustrator(illustrator);

		// 下载
		await downloadIllusts(info.illusts, Path.join(config.path, info.dir), config.thread);

		// 回调
		if (typeof callback === 'function') callback(i);
	}
}

/**
 * 获得该画师需要下载的画作列表
 *
 * @param {Illustrator} illustrator
 * @returns
 */
async function getDownloadListByIllustrator(illustrator) {
	let illusts = [];

	// 得到画师下载目录
	const dir = await illustrator.info().then(getIllustratorNewDir);
	const dldir = Path.join(config.path, dir);
	const ugoiraDir = new UgoiraDir(dldir);
	const illustExists = file => (file.endsWith('.zip') ? ugoiraDir.existsSync(file) : Fse.existsSync(Path.join(dldir, file)));

	// 最新画作检查
	const exampleIllusts = illustrator.exampleIllusts;
	if (exampleIllusts) {
		let existNum = 0;
		for (const ei of exampleIllusts) {
			if (illustExists(ei.file)) existNum++;
			else illusts.push(ei);
		}
		if (existNum > 0) {
			return {
				dir,
				illusts: illusts.reverse(),
			};
		}
	}

	// 得到未下载的画作
	illusts = [];

	const processDisplay = Tools.showProgress(() => illusts.length);

	let cnt;
	do {
		cnt = 0;
		const temps = await illustrator.illusts();
		for (const temp of temps) {
			if (!illustExists(temp.file)) {
				illusts.push(temp);
				cnt++;
			}
		}
	} while (illustrator.hasNext('illust') && cnt > 0);

	Tools.clearProgress(processDisplay);

	return {
		dir,
		illusts: illusts.reverse(),
	};
}

/**
 * 下载自己的收藏
 *
 * @param {Illustrator} me 自己
 * @param {boolean} [isPrivate=false] 是否是私密
 * @returns
 */
async function downloadByBookmark(me, isPrivate = false) {
	// 得到画师下载目录
	const dir = '[bookmark] ' + (isPrivate ? 'Private' : 'Public');
	const dldir = Path.join(config.path, dir);
	const ugoiraDir = new UgoiraDir(dldir);
	const illustExists = file => (file.endsWith('.zip') ? ugoiraDir.existsSync(file) : Fse.existsSync(Path.join(dldir, file)));

	console.log('\nCollecting illusts of your bookmark');

	// 得到未下载的画作
	const illusts = [];

	const processDisplay = Tools.showProgress(() => illusts.length);

	const jsonPath = Path.join(__dirname, '../data');
	Fse.ensureDirSync(jsonPath);

  const lastIllustsPath = Path.join(jsonPath, '_last_illusts.json');
	const lastIllusts = Fse.readJSONSync(lastIllustsPath) || [];
	console.log('Last Illusts:', lastIllusts.length);
	if (lastIllusts.length) {
	  Tools.clearProgress(processDisplay);
	  console.log('Start downloading...');
	  await downloadIllusts(
	    lastIllusts.filter(e => !illustExists(e.file)).reverse(), 
	    Path.join(dldir), 
	    config.thread
	  );
	  Fse.writeJSONSync(lastIllustsPath, []);
	  return
	}
	
	const lastIdPath = Path.join(jsonPath, '_last_id.json');
	const lastIllust = Fse.readJSONSync(lastIdPath);
  console.log('Last Id: ', lastIllust.id);

	const tempPath = Path.join(jsonPath, 'tmp');
	Fse.ensureDirSync(tempPath);

	let firstRun = true;
	let newLastId = lastIllust.id;
	let stop = false;
	do {
		const temps = await me.bookmarks(isPrivate);
		if (firstRun) {
		  newLastId = temps[0].id;
			firstRun = false;
		}
		const reqID = temps.reqID
		console.log('\ntemps.reqID: ', reqID);
		Fse.writeJSONSync(Path.join(tempPath, reqID + '.json'), temps.reqJSON);
		for (const temp of temps) {
			if (!illustExists(temp.file)) {
			  temp._bkId = reqID;
				illusts.push(temp);
			}
			if (temp.id == lastIllust.id) {
				console.log('\n--- OVER ---\n');
				stop = true;
			}
		}
		console.log('Wait 1s...');
		await new Promise(resolve => setTimeout(resolve, 1000));
	} while (!stop && me.hasNext('bookmark'));

	Tools.clearProgress(processDisplay);

	Fse.writeJSONSync(lastIdPath, { id: newLastId });
	Fse.writeJSONSync(lastIllustsPath, illusts);

  console.log('Start downloading...');

	// 下载
	await downloadIllusts(illusts.reverse(), Path.join(dldir), config.thread);
	Fse.writeJSONSync(lastIllustsPath, []);
}

/**
 * 多线程下载插画队列
 *
 * @param {Array<Illust>} illusts 插画队列
 * @param {string} dldir 下载目录
 * @param {number} totalThread 下载线程
 * @returns 成功下载的画作数
 */
function downloadIllusts(illusts, dldir, totalThread) {
	const tempDir = config.tmp;
	let totalI = 0;

	// 清除残留的临时文件
	if (Fse.existsSync(tempDir)) Fse.removeSync(tempDir);

	// 开始多线程下载
	let errorThread = 0;
	let pause = false;
	const hangup = 1 * 60 * 1000;
	let errorTimeout = null;

	// 单个线程
	function singleThread(threadID) {
		return new Promise(async resolve => {
			while (true) {
				const i = totalI++;
				// 线程终止
				if (i >= illusts.length) return resolve(threadID);

				const illust = illusts[i];

				const options = {
					headers: {
						referer: pixivRefer,
					},
					timeout: 1000 * config.timeout,
				};
				// 代理
				if (httpsAgent) options.httpsAgent = httpsAgent;

				// 开始下载
				console.log(`  [${threadID}]\t${(parseInt(i) + 1).toString().green}/${illusts.length}\t ${'pid'.gray} ${illust.id.toString().cyan}\t${illust.title.yellow}`);
				await (async function tryDownload(times) {
					if (times > 10) {
						if (errorThread > 1) {
							if (errorTimeout) clearTimeout(errorTimeout);
							errorTimeout = setTimeout(() => {
								console.log('\n' + 'Network error! Pause 1 minutes.'.red + '\n');
							}, 1000);
							pause = true;
						} else return;
					}
					if (pause) {
						times = 1;
						await sleep(hangup);
						pause = false;
					}
					// 失败重试
					return Tools.download(tempDir, illust.file, illust.url, options)
						.then(async res => {
							// 文件完整性校验
							const fileSize = res.headers['content-length'];
							const dlFile = Path.join(tempDir, illust.file);
							// 针对Linux文件系统不明bug
							await sleep(1000);
							for (let i = 0; i < 15 && !Fse.existsSync(dlFile); i++) await sleep(200);
							const dlFileSize = Fse.statSync(dlFile).size;
							if (!fileSize || dlFileSize == fileSize) {
							  Fse.moveSync(dlFile, Path.join(dldir, illust.file));
							} else {
								Fse.unlinkSync(dlFile);
								throw new Error(`Incomplete download ${dlFileSize}/${fileSize}`);
							}
							if (times != 1) errorThread--;
						})
						.catch(e => {
							if (e && e.response && e.response.status == 404) {
								console.log('  ' + '404'.bgRed + `\t${(parseInt(i) + 1).toString().green}/${illusts.length}\t ${'pid'.gray} ${illust.id.toString().cyan}\t${illust.title.yellow}`);
								return;
							} else if (times == 1) errorThread++;
							if (global.p_debug) console.log(e);
							console.log(
								`  ${times >= 10 ? `[${threadID}]`.bgRed : `[${threadID}]`.bgYellow}\t${(parseInt(i) + 1).toString().green}/${illusts.length}\t ${'pid'.gray} ${
									illust.id.toString().cyan
								}\t${illust.title.yellow}`
							);
							return tryDownload(times + 1);
						});
				})(1);
			}
		});
	}

	const threads = [];

	// 开始多线程
	for (let t = 0; t < totalThread; t++)
		threads.push(
			singleThread(t).catch(e => {
				if (global.p_debug) console.log(e);
			})
		);

	return Promise.all(threads);
}

/**
 * 得到某个画师对应的下载目录名
 *
 * @param {*} data 画师资料
 * @returns 下载目录名
 */
async function getIllustratorNewDir(data) {
	// 下载目录
	const mainDir = config.path;
	let dldir = null;

	// 先搜寻已有目录
	Fse.ensureDirSync(mainDir);
	const files = Fse.readdirSync(mainDir);
	for (const file of files) {
		if (file.indexOf('(' + data.id + ')') === 0) {
			dldir = file;
			break;
		}
	}

	// 去除画师名常带的摊位后缀，以及非法字符
	let iName = data.name;
	const nameExtIndex = iName.search(/@|＠/);
	if (nameExtIndex >= 1) iName = iName.substring(0, nameExtIndex);
	iName = iName.replace(/[/\\:*?"<>|.&$]/g, '').replace(/[ ]+$/, '');
	const dldirNew = '(' + data.id + ')' + iName;

	// 决定下载目录
	if (!dldir) {
		dldir = dldirNew;
	} else if (config.autoRename && dldir.toLowerCase() != dldirNew.toLowerCase()) {
		try {
			Fse.renameSync(Path.join(mainDir, dldir), Path.join(mainDir, dldirNew));
			dldir = dldirNew;
			console.log('\nDirectory renamed: %s => %s', dldir.yellow, dldirNew.green);
		} catch (error) {
			console.log('\nDirectory rename failed: %s => %s', dldir.yellow, dldirNew.red);
			console.error(error);
		}
	}

	return dldir;
}

/**
 * 根据PID下载
 * @method downloadByIllusts
 * @param {Array} illustJSON 由API得到的画作JSON
 */
async function downloadByIllusts(illustJSON) {
	console.log();
	let illusts = [];
	for (const json of illustJSON) {
		illusts = illusts.concat(await Illust.getIllusts(json));
	}
	await downloadIllusts(illusts, Path.join(config.path, 'PID'), config.thread);
}

function sleep(ms) {
	return new Promise(resolve => {
		setTimeout(resolve, ms);
	});
}

module.exports = {
	setConfig,
	setAgent,
	downloadByIllusts,
	downloadByIllustrators,
	downloadByBookmark,
};
