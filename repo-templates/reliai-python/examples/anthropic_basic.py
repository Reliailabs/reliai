import reliai

reliai.init()


@reliai.trace
def answer_question(question: str):
    return f"answer: {question}"
