import reliai

reliai.init()
reliai.auto_instrument()


def main():
    print("OpenAI SDK calls are instrumented automatically after reliai.auto_instrument().")


if __name__ == "__main__":
    main()
