## 使用说明

1. 安装并配置好Deno环境
2. 在项目中编写构建脚本(例如`build.ts`), 参照example.ts
3. 配置minio的环境变量, 可以配置到全局, 也可以使用.env文件

```shell
BUILDER_OSS_END_POINT=xxx
BUILDER_OSS_ACCESS_KEY=xxx
BUILDER_OSS_SECRET_KEY=xxx
```

4. 使用deno执行该构建脚本.

- `target`目前可以为win(默认可以不写)/linux/docker
- `-p`为推送构建产物到minio
- `-v`后接版本号

```shell
deno run -A build.ts [target] [-p] [-v [x.x.x]]
```
