"""
DigDeep decider server
Wraps your Strands "decider" agent in a tiny web server so the Chrome extension can call it.

    Extension  --POST /decide {"prompt": "..."}-->  this server  -->  Strands agent
               <------------- {"reply": "..."} ---------------

Run:
    pip install -r requirements.txt
    python decider_server.py
Then in the extension's background.js set MODE: "decider".
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from strands import Agent
import uvicorn

SYSTEM_PROMPT = (
    "You are a decision agent. You are given a highlighted term, the text around it, "
    "and numbered options taken from Wikipedia. Choose ONLY from the options given. "
    "Never invent facts. Reply with JSON only."
)


def make_decider() -> Agent:
    """
    Build the decider agent.

    >>> Replace the body of this function with the SAME agent setup your teammate
    >>> already uses in their terminal script (their model + settings), e.g.:
    >>>
    >>>   from strands.models.ollama import OllamaModel
    >>>   model = OllamaModel(host="http://localhost:11434", model_id="llama3")
    >>>   return Agent(model=model, system_prompt=SYSTEM_PROMPT, callback_handler=None)

    A fresh agent is made for every request, so earlier digs don't leak into
    the next decision (agents remember their conversation otherwise).
    """
    from strands.models.ollama import OllamaModel

    model = OllamaModel(host="http://localhost:11434", model_id="llama3.2")
    return Agent(model=model, system_prompt=SYSTEM_PROMPT, callback_handler=None)


app = FastAPI(title="DigDeep decider")

# The extension's background script isn't blocked by CORS, but this keeps
# browser-based testing working too. Only extensions and localhost may call it.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^(chrome-extension://.*|http://localhost(:\d+)?)$",
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class DecideRequest(BaseModel):
    prompt: str


@app.get("/")
def health():
    return {"status": "decider is running"}


@app.post("/decide")
def decide(req: DecideRequest):
    agent = make_decider()
    result = agent(req.prompt[:20000])  # cap the prompt size
    return {"reply": str(result)}


if __name__ == "__main__":
    # 127.0.0.1 = only this laptop can reach it
    uvicorn.run(app, host="127.0.0.1", port=8000)
