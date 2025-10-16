帮我在当前目录下，新开一个agent，使用 claude /execute -p --dangerously-skip-permissions --output-format stream-json --verbose 命令开启一个 claude code 进程。注意观察任务执行情况： 
1. 如果当前任务完成（任务运行时间较长，可以多等一会，通过检查输出文件/日志判断），就结束当前claude code进程； 
2. 结束后，重新开一个新的agent，运行相同的claude code指令，让它继续执行TODO List中的下一个任务； 
3. 每次打开claude code和监控它运行，都必须调用一个新的agent（Task Tool）来执行，避免主agent的上下文太长。