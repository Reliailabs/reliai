import reliai

reliai.init()


@reliai.trace
def run_chain(input_text: str):
    return {"input": input_text, "answer": input_text}
