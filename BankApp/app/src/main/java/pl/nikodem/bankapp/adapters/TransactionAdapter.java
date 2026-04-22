package pl.nikodem.bankapp.adapters;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import pl.nikodem.bankapp.R;
import pl.nikodem.bankapp.models.Transaction;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class TransactionAdapter extends RecyclerView.Adapter<TransactionAdapter.ViewHolder> {

    private List<Transaction> transactions;
    private SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault());
    private SimpleDateFormat outputFormat = new SimpleDateFormat("dd.MM.yyyy HH:mm", Locale.getDefault());

    public TransactionAdapter(List<Transaction> transactions) {
        this.transactions = transactions;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_transaction, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Transaction transaction = transactions.get(position);

        holder.tvDescription.setText(transaction.getDescription());

        double amount = transaction.getAmount();
        String amountText = (amount >= 0 ? "+" : "") + String.format("%.2f PLN", amount);
        holder.tvAmount.setText(amountText);

        if (amount > 0) {
            holder.tvAmount.setTextColor(Color.parseColor("#4CAF50"));
        } else {
            holder.tvAmount.setTextColor(Color.parseColor("#F44336"));
        }

        try {
            Date date = inputFormat.parse(transaction.getCreatedAt());
            if (date != null) {
                holder.tvDate.setText(outputFormat.format(date));
            } else {
                holder.tvDate.setText(transaction.getCreatedAt());
            }
        } catch (ParseException e) {
            holder.tvDate.setText(transaction.getCreatedAt());
        }

        String typeIcon = getTypeIcon(transaction.getType());
        holder.tvType.setText(typeIcon);
    }

    private String getTypeIcon(String type) {
        switch (type) {
            case "transfer":
                return "↔";
            case "blik_payment":
                return "📱";
            case "deposit":
                return "↓";
            case "withdraw":
                return "↑";
            default:
                return "•";
        }
    }

    @Override
    public int getItemCount() {
        return transactions.size();
    }

    public void updateData(List<Transaction> newTransactions) {
        this.transactions = newTransactions;
        notifyDataSetChanged();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvType, tvDescription, tvAmount, tvDate;

        ViewHolder(View itemView) {
            super(itemView);
            tvType = itemView.findViewById(R.id.tvType);
            tvDescription = itemView.findViewById(R.id.tvDescription);
            tvAmount = itemView.findViewById(R.id.tvAmount);
            tvDate = itemView.findViewById(R.id.tvDate);
        }
    }
}
