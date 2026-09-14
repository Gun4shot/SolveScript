import argparse
from huggingface_hub import HfApi


parser = argparse.ArgumentParser(description="Publish verified written-paper PDFs to a Hugging Face Dataset repository.")
parser.add_argument("--folder", required=True)
parser.add_argument("--repo", required=True)
parser.add_argument("--path-in-repo", default="caie")
args = parser.parse_args()

api = HfApi()
api.upload_folder(
    folder_path=args.folder,
    repo_id=args.repo,
    repo_type="dataset",
    path_in_repo=args.path_in_repo,
    allow_patterns="**/*.pdf",
    commit_message="Publish verified SolveScript CAIE written-paper archive",
)
print(f"Published verified PDFs to {args.repo}")
