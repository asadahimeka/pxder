# pixiv downloader
![运行示例](https://i.loli.net/2018/08/20/5b7aaccfb1c4a.gif)

目前只试做了一个下载某一画师的所有插画的功能，其余功能仍在开发中

简单写下说明（针对 Windows 用户）


## 准备
首先你需要先安装 Node.js  
打开[官网](https://nodejs.org) => 下载右边的“最新发布版” => 安装一路确定


## 安装/更新/卸载
打开“命令提示符”或者“Powershell”，执行，即可安装或者更新（注：后续命令皆为在此执行）
```bash
npm i -g pxder
```

如需卸载，执行
```bash
npm uninstall -g pxder
```


## 配置
### 登录
```bash
pxder --login
```
然后会让你输入用户名密码，登录成功一次后以后如果没有出什么bug则无需再次登录

如果要登出
```bash
pxder --logout
```

### 设置
进入 Pxder 的设置界面
```bash
pxder --setting
```

有四项设置，按下数字键选择一项进行设置，然后按照要求输入之后回车即可
```bash
[1] Download path	# 下载目录，必须设置
[2] Download thread	# 下载线程数
[3] Download timeout	# 下载超时
[4] Auto rename		# 自动重命名（文件夹）
[5] Proxy		# 使用代理
```

- **下载目录**
  请注意相对路径与绝对路径的区别
  目录无需手动建立，下载图片的时候会自动建立
- **下载线程数**
  即同时下载的图片数，默认为`5`，最小为`1`，最大为`10`，因为其实不推荐使用过多的线程
  下载图片时最左侧的一列实际上就是线程编号
- **下载超时**
  如果这么多秒之后一张图还没被下载完则算作超时，超时后会自动重试，默认值为`30`
  下载图片时如果线程编号是红色的就代表此次是重试
- **自动重命名**
  开启了以后，例如这个画师原来叫`abc`，今天你再次去下载（更新）他的画作，但是他改名叫`def`了，那么程序会自动帮你重命名画师文件夹
- **使用代理**
  支持使用 HTTP 或 SOCKS 代理，即可以使用小飞机
  输入格式为`<协议>://[用户名:密码@]<IP>:<端口>`，例如：
  - `http://127.0.0.1:1080`
  - `socks://abc:def@127.0.0.1:1080`
  
  如果输入空行则关闭代理


## 运行机制
- 会将同一画师的作品下载在`(UID)画师名`格式的文件夹内，图片命名格式为`(PID)作品名`
  并且，画师名会自动删除名字中`@`符号及以后的文字（因为这些基本上都是画师的摊位信息之类的与名字无关的信息）
- 文件（夹）名均会过滤掉所有 Windows 和 Linux 中不能或不推荐做文件名的符号
- 动图下下来会是所有帧的压缩包
- 下载时会忽略掉已经下载的插画，但是如果你下载到一半退出，会在`temp`文件夹内残留未下载完整的坏图片，你可以自行删除，或者当你再次开始同一画师的下载时也会自动被删除
- 下载超时或网络错误会自动重试


## 正式使用
小知识：在命令行中按下`Ctrl + C`可终止执行

### 下载某画师的所有插画作品
使用`--uid`参数，后跟画师的 UID，可单个可多个，如果多个则用英文半角逗号隔开
```bash
pxder --uid uid1,uid2,uid3,...
```

例如
```bash
pxder --uid 5899479,724607,11597411
```

## TODO
- [x] 使用代理下载的选项
- [ ] 下载所有已关注画师的插画
- [ ] 智能增量下载
