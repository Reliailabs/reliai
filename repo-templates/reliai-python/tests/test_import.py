from reliai import ReliaiClient


def test_client_import():
    assert ReliaiClient("demo").project == "demo"
