import reliai

reliai.init()
reliai.auto_instrument()


def main():
    print("LangChain invoke and tool calls are instrumented automatically.")


if __name__ == "__main__":
    main()
