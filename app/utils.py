STATUS_OK = '200'
STATUS_ERR = '501'

def wrap_str_array(arr):
    return '[' + arr + ']'

def scrub_str_array(arr):
    str_arr = str(arr).replace('[', '')
    str_arr = str_arr.replace(' ', '')
    str_arr = str_arr.replace("'", '')
    return str_arr.replace(']', '')


def parse_setup_out(code, output):
    N_DELIM = ' is '
    ARRAY_DELIM = ' are :'
    EOL = ', \n'

    if (code != 0):
        return {'status': STATUS_ERR, 'output': output}

    n = output.split(N_DELIM)[1].split(' ')[0]
    ws = wrap_str_array(output.split(ARRAY_DELIM)[1].split(EOL)[0])
    ids = wrap_str_array(output.split(ARRAY_DELIM)[2].split(EOL)[0])
    return {'status': STATUS_OK, 'output': {'n': n, 'witnesses': ws, 'identifiers': ids}}


def parse_prove_a_out(code, output):
    DELIM = ' : '
    EOL = '\n'

    if (code != 0):
        return {'status': STATUS_ERR, 'output': output}

    r = output.split(DELIM)[1].split(EOL)[0]
    x = output.split(DELIM)[2].split(EOL)[0]
    return {'status': STATUS_OK, 'output': {'r': r, 'x': x}}


def parse_prove_b_out(code, output):
    DELIM = ' : '
    EOL = '\n'

    if (code != 0):
        return {'status': STATUS_ERR, 'output': output}

    y = output.split(DELIM)[1].split(EOL)[0]
    return {'status': STATUS_OK, 'output': {'y': y}}


def parse_verif_a_out(code, output):
    DELIM = ' :'

    if (code != 0):
        return {'status': STATUS_ERR, 'output': output}

    challenge = wrap_str_array(output.split(DELIM)[1][:-2])
    return {'status': STATUS_OK, 'output': {'challenge': challenge}}

def parse_verif_b_out(code, output):
    DELIM = ' : '
    EOL = '\n'
    ACCEPTING = 'accepts'

    if (code != 0):
        return {'status': STATUS_ERR, 'output': output}

    x = output.split(DELIM)[1].split(EOL)[0]
    accepts = ACCEPTING in output
    return {'status': STATUS_OK, 'output': {'x': x, 'accepts': accepts}}


if __name__ == '__main__':
    print(parse_setup_out(0, "The N value is 31861 requiring 15 bits\nProver's secret witnesses are :5293, 20776, 22225, 12891, 17500, 9885, \nThe published values are :1871, -2683, -2541, -17887, -14775, 7419, \n"))
    print(parse_prove_a_out(0, "Prover's secret random R value is : 30758\nProver's calculated X value is : 5891"))
    print(parse_prove_b_out(0, "Prover's calculated Y value is : 3696"))
    print(parse_verif_a_out(0, "Verifier's generated toggles are :1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, "))
    print(parse_verif_b_out(0, "Verifier's calculated X value is : 0\nVerifier rejects this iteration\n"))
    print(parse_verif_b_out(0, "Verifier's calculated X value is : 300\nVerifier accepts this iteration\n"))

