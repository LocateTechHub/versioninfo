package version

import (
	"flag"
	"fmt"
	"os"
	"strconv"
	"time"
)

func AddFlag(f *flag.FlagSet) {
	if f == nil {
		f = flag.CommandLine
	}
	f.BoolFunc("v", "short alias for -version", printVersion)
	f.BoolFunc("version", "print version information and exit", printVersion)

	flag.Parse()
}

func printVersion(s string) error {
	b, err := strconv.ParseBool(s)
	if err != nil {
		return err
	}
	if !b {
		return nil
	}
	fmt.Println("Version:", Version)
	fmt.Println("GitHash:", GitHash)
	fmt.Println("GitBranch:", GitBranch)
	fmt.Println("GitMessage:", GitMessage)
	fmt.Println("Author:", Author)
	fmt.Println("DirtyBuild:", DirtyBuild)
	fmt.Println("BuildTime:", formatBuildTime())
	os.Exit(0)
	return nil
}

func PrintVersion() {
	dirty := "-hotfix"
	b, err := strconv.ParseBool(DirtyBuild)
	if err == nil && !b {
		dirty = ""
	}
	shortHash := GitHash[:7]
	fmt.Printf("version: [%s%s-%s %s] time: [%s] %s \n", GitBranch, dirty, shortHash, Author, formatBuildTime(), GitMessage)
}

func formatBuildTime() string {
	if BuildTime != "unknown" {
		bt, err := strconv.ParseInt(BuildTime, 10, 0)
		if err == nil {
			return time.UnixMilli(bt).Format("2006-01-02 15:04:05")
		}
	}
	return BuildTime
}
